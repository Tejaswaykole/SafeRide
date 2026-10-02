#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// REPLACE WITH YOUR BACKEND IP
// DO NOT USE localhost!
const char* API_BASE_URL = "http://192.168.1.100:8000";
const char* DEVICE_ID = "SAFERIDE-001";
const int VEHICLE_DB_ID = 1; // Used for the reset endpoint

const unsigned long SENSOR_INTERVAL = 1000; // 1 second loop

// ==========================================
// GPIO MAP
// ==========================================
// MPU6050 and OLED share I2C (SDA = 21, SCL = 22) default Wire
constexpr int MQ3_PIN = 34;
constexpr int GPS_RX_PIN = 16;
constexpr int GPS_TX_PIN = 17;
constexpr int BTN_BLOW = 27;
constexpr int BTN_RESET = 26;

constexpr int LED_GREEN = 25;
constexpr int LED_YELLOW = 33;
constexpr int LED_RED_ENG = 32;
constexpr int LED_WHITE_CRIT = 13;
constexpr int PIN_BUZZER = 14;
constexpr int PIN_RELAY = 23;

// ==========================================
// GLOBALS & OBJECTS
// ==========================================
Adafruit_MPU6050 mpu;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1); // Use UART1 for GPS

String currentStatus = "SAFE";
int currentRisk = 0;
bool engineOn = true;
String currentReason = "";
bool backendConnected = false;

// Button state
bool blowDetected = false;
unsigned long lastBlowTime = 0;
const unsigned long BLOW_COOLDOWN = 15000;
unsigned long lastResetPress = 0;

// Main loop timing
unsigned long lastSensorPostTime = 0;

// Output State Machine (Buzzer & LEDs)
unsigned long buzzerStartTime = 0;
int buzzerDurationSec = 0; // 0 = OFF
bool buzzerActive = false;

// White LED blinking
unsigned long lastBlinkTime = 0;
bool whiteLedState = false;

void setup() {
  Serial.begin(115200);
  
  // Output Pins
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED_ENG, OUTPUT);
  pinMode(LED_WHITE_CRIT, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  
  // Button Pins
  pinMode(BTN_BLOW, INPUT_PULLUP);
  pinMode(BTN_RESET, INPUT_PULLUP);

  // Safe Startup State
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED_ENG, LOW);
  digitalWrite(LED_WHITE_CRIT, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_RELAY, HIGH); // Assuming HIGH means Relay ON/Engine Connected

  // I2C Init
  Wire.begin();

  // OLED Init
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0,0);
    display.println("SafeRide Starting...");
    display.display();
  }

  // MPU6050 Init
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // GPS Init
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // WiFi Init
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Always feed GPS
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 2. Handle Buttons
  if (digitalRead(BTN_BLOW) == LOW) {
    if (currentMillis - lastBlowTime > BLOW_COOLDOWN) {
      blowDetected = true;
      lastBlowTime = currentMillis;
      Serial.println("BLOW DETECTED!");
    }
  }

  if (digitalRead(BTN_RESET) == LOW) {
    if (currentMillis - lastResetPress > 5000) { // Simple debounce
      lastResetPress = currentMillis;
      sendResetRequest();
    }
  }

  // 3. Post Sensor Data Every Interval
  if (currentMillis - lastSensorPostTime >= SENSOR_INTERVAL) {
    lastSensorPostTime = currentMillis;
    postSensorData();
    updateOLED();
    printDiagnostics();
    // Reset blow logic for next cycle since we just sent it
    blowDetected = false; 
  }

  // 4. Handle Hardware Outputs non-blocking
  handlePhysicalOutputs(currentMillis);
}

void handlePhysicalOutputs(unsigned long currentMillis) {
  // If CRITICAL, blink white LED
  if (currentStatus == "CRITICAL") {
    if (currentMillis - lastBlinkTime > 500) {
      lastBlinkTime = currentMillis;
      whiteLedState = !whiteLedState;
      digitalWrite(LED_WHITE_CRIT, whiteLedState ? HIGH : LOW);
    }
  } else {
    digitalWrite(LED_WHITE_CRIT, LOW);
  }

  // Handle Buzzer Timing
  if (buzzerDurationSec > 0) {
    if (!buzzerActive) {
      // Start buzzer
      buzzerActive = true;
      buzzerStartTime = currentMillis;
      digitalWrite(PIN_BUZZER, HIGH);
    } else {
      // Check if duration expired
      if (currentMillis - buzzerStartTime >= (buzzerDurationSec * 1000UL)) {
        digitalWrite(PIN_BUZZER, LOW);
        buzzerActive = false;
        buzzerDurationSec = 0; // consumed
      }
    }
  } else {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerActive = false;
  }
}

void postSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    backendConnected = false;
    return;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/sensor-data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Read Sensors
  int alcoholVal = analogRead(MQ3_PIN);
  sensors_event_t a, g, temp;
  if(mpu.begin()) mpu.getEvent(&a, &g, &temp);

  // Build JSON
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["blow_detected"] = blowDetected;
  doc["alcohol_value"] = alcoholVal;
  
  doc["accel_x"] = a.acceleration.x;
  doc["accel_y"] = a.acceleration.y;
  doc["accel_z"] = a.acceleration.z;
  
  doc["gyro_x"] = g.gyro.x;
  doc["gyro_y"] = g.gyro.y;
  doc["gyro_z"] = g.gyro.z;
  
  doc["temperature"] = temp.temperature;

  if (gps.location.isValid()) {
    doc["latitude"] = gps.location.lat();
    doc["longitude"] = gps.location.lng();
  } else {
    doc["latitude"] = nullptr;
    doc["longitude"] = nullptr;
  }

  String payload;
  serializeJson(doc, payload);

  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    backendConnected = true;
    String responseStr = http.getString();
    
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, responseStr);
    
    if (!err) {
      currentStatus = resDoc["status"].as<String>();
      currentRisk = resDoc["risk_score"].as<int>();
      int engState = resDoc["engine_state"].as<int>(); // 1=ON, 0=OFF
      int buzAction = resDoc["buzzer_action"].as<int>();
      
      bool isAlcohol = resDoc["alcohol_detected"].as<bool>();
      bool isRash = resDoc["rash_driving_detected"].as<bool>();
      
      engineOn = (engState == 1);

      // Handle Reason text
      if (currentStatus == "CRITICAL") currentReason = "ALCOHOL+RASH";
      else if (isAlcohol) currentReason = "ALCOHOL";
      else if (isRash) currentReason = "RASH DRIVING";
      else currentReason = "SAFE";

      applyBackendState(engState, buzAction);
    }
  } else {
    backendConnected = false;
    Serial.print("Error sending POST: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendResetRequest() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/vehicles/" + String(VEHICLE_DB_ID) + "/reset";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST("{}");
  if (httpCode == 200) {
    Serial.println("Reset applied on backend successfully.");
    // The next sensor post will fetch the reset SAFE state
  }
  http.end();
}

void applyBackendState(int engState, int buzAction) {
  // Apply LEDs based on status
  if (currentStatus == "SAFE") {
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED_ENG, HIGH); // Engine is normal
    digitalWrite(PIN_RELAY, HIGH);
    // Buzzer OFF is handled by 0 duration
  } else if (currentStatus == "WARNING") {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED_ENG, HIGH); 
    digitalWrite(PIN_RELAY, HIGH);
  } else if (currentStatus == "CRITICAL") {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED_ENG, LOW); // Engine killed
    digitalWrite(PIN_RELAY, LOW);   // Kill relay
  }

  // Update buzzer state machine logic.
  // If the backend sends buzAction > 0, we trigger that duration.
  // We only trigger it if it's not already buzzing, or if it's a new critical event.
  // (In a real scenario, the backend might pulse it continuously or once per state transition).
  if (buzAction > 0) {
    if (!buzzerActive || currentStatus == "CRITICAL") {
      buzzerDurationSec = buzAction;
    }
  } else {
    buzzerDurationSec = 0;
  }
}

void updateOLED() {
  display.clearDisplay();
  display.setCursor(0, 0);

  if (!backendConnected) {
    display.println("OLED ERROR / No Conn");
    display.display();
    return;
  }

  display.println(currentStatus == "SAFE" ? "SAFERIDE" : currentStatus);
  display.println("------------");
  
  if (currentStatus == "SAFE") {
    display.println("STATUS: SAFE");
    display.print("RISK: "); display.println(currentRisk);
    display.print("ENG: "); display.println(engineOn ? "ON" : "OFF");
  } else if (currentStatus == "WARNING") {
    display.println(currentReason);
    display.print("RISK: "); display.println(currentRisk);
    display.print("ENG: "); display.println(engineOn ? "ON" : "OFF");
  } else if (currentStatus == "CRITICAL") {
    display.println(currentReason);
    display.print("ENGINE: "); display.println("OFF");
  }

  display.display();
}

void printDiagnostics() {
  Serial.println("\n================================");
  Serial.println("SAFERIDE ESP32");
  Serial.println("================================");
  Serial.print("WiFi: "); Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
  Serial.print("Backend: "); Serial.println(backendConnected ? "CONNECTED" : "DISCONNECTED");
  Serial.print("MQ3: "); Serial.println(analogRead(MQ3_PIN));
  Serial.print("GPS: "); Serial.println(gps.location.isValid() ? "FIX" : "NO FIX");
  Serial.print("STATUS: "); Serial.println(currentStatus);
  Serial.print("RISK: "); Serial.println(currentRisk);
  Serial.print("ENGINE: "); Serial.println(engineOn ? "ON" : "OFF");
  Serial.println("================================\n");
}
