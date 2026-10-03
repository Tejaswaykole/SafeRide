#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char* WIFI_SSID = "OnePlus Nord CE 3 Lite 5G";
const char* WIFI_PASSWORD = "tejuuu9011";

const char* API_BASE_URL = "http://192.168.1.100:8000";
const char* DEVICE_ID = "SAFERIDE-001";
const int VEHICLE_DB_ID = 1;

const unsigned long SENSOR_INTERVAL = 1000;
const unsigned long WIFI_RETRY_INTERVAL = 5000;
const unsigned long DHT_INTERVAL = 2500;

// ==========================================
// GPIO MAP & POLARITY
// ==========================================
constexpr int MQ3_PIN = 34;       
constexpr int DHT_PIN = 4;        
#define DHTTYPE DHT11
constexpr int GPS_RX_PIN = 16;    
constexpr int GPS_TX_PIN = 17;    
constexpr int BTN_RESET = 26;     

constexpr int LED_GREEN = 25;     
constexpr int LED_BLUE_WARN = 33; 
constexpr int LED_RED_CRIT = 32;  
constexpr int LED_RED_ENG = 13;   
constexpr int LED_WHITE_SYS = 14; 
constexpr int PIN_BUZZER = 27;    
constexpr int PIN_RELAY = 23;     

constexpr int RELAY_ON_LEVEL = HIGH;
constexpr int RELAY_OFF_LEVEL = LOW;

// ==========================================
// GLOBALS & OBJECTS
// ==========================================
DHT dht(DHT_PIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

bool mpuInitialized = false;
float mpu_ax=0, mpu_ay=0, mpu_az=0;
float mpu_gx=0, mpu_gy=0, mpu_gz=0;

float currentTemp = NAN;

String currentStatus = "SAFE";
String previousStatus = "SAFE";
int currentRisk = 0;
bool engineOn = true;
String currentReason = "";
bool backendConnected = false;
bool previousAlcohol = false;
bool previousRash = false;

unsigned long lastResetPress = 0;
unsigned long lastSensorPostTime = 0;
unsigned long lastWiFiRetryTime = 0;
unsigned long lastDhtTime = 0;

enum BuzzerMode { BUZZER_OFF, BUZZER_RASH, BUZZER_ALCOHOL, BUZZER_CRITICAL };
BuzzerMode currentBuzzerMode = BUZZER_OFF;
unsigned long buzzerStateTimer = 0;
bool buzzerPinState = false;

// ==========================================
// MPU6050 RAW DRIVER
// ==========================================
void mpuWriteRegister(uint8_t reg, uint8_t data) {
  Wire.beginTransmission(0x68);
  Wire.write(reg);
  Wire.write(data);
  Wire.endTransmission();
}

uint8_t mpuReadRegister(uint8_t reg) {
  Wire.beginTransmission(0x68);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((uint16_t)0x68, (size_t)1);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0;
}

bool mpuInitialize() {
  Wire.begin(21, 22);
  Wire.setClock(100000);
  
  uint8_t whoami = mpuReadRegister(0x75);
  if (whoami != 0x68) return false;
  
  // Wake up
  mpuWriteRegister(0x6B, 0x00);
  delay(10);
  uint8_t pwr = mpuReadRegister(0x6B);
  if (pwr != 0x00) return false;

  // Set ranges: 8g and 500 deg/s to match old Adafruit ranges
  mpuWriteRegister(0x1C, 0x10); // Accel config: 8g (4096 LSB/g)
  mpuWriteRegister(0x1B, 0x08); // Gyro config: 500 deg/s (65.5 LSB/deg/s)
  
  return true;
}

void mpuReadData() {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom((uint16_t)0x68, (size_t)14, true);
  
  if (Wire.available() == 14) {
    int16_t raw_ax = (Wire.read() << 8 | Wire.read());
    int16_t raw_ay = (Wire.read() << 8 | Wire.read());
    int16_t raw_az = (Wire.read() << 8 | Wire.read());
    int16_t raw_temp = (Wire.read() << 8 | Wire.read());
    int16_t raw_gx = (Wire.read() << 8 | Wire.read());
    int16_t raw_gy = (Wire.read() << 8 | Wire.read());
    int16_t raw_gz = (Wire.read() << 8 | Wire.read());
    
    mpu_ax = (raw_ax / 4096.0) * 9.80665;
    mpu_ay = (raw_ay / 4096.0) * 9.80665;
    mpu_az = (raw_az / 4096.0) * 9.80665;
    
    mpu_gx = (raw_gx / 65.5) * 0.0174533; 
    mpu_gy = (raw_gy / 65.5) * 0.0174533;
    mpu_gz = (raw_gz / 65.5) * 0.0174533;
  }
}

// ==========================================
// SETUP & LOOP
// ==========================================
void setup() {
  Serial.begin(115200);
  
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE_WARN, OUTPUT);
  pinMode(LED_RED_CRIT, OUTPUT);
  pinMode(LED_RED_ENG, OUTPUT);
  pinMode(LED_WHITE_SYS, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  
  pinMode(BTN_RESET, INPUT_PULLUP);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_BLUE_WARN, LOW);
  digitalWrite(LED_RED_CRIT, LOW);
  digitalWrite(LED_RED_ENG, LOW);
  digitalWrite(LED_WHITE_SYS, HIGH); 
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);

  Serial.println("\n========================================");
  Serial.println("SafeRide ESP32");
  Serial.println("========================================");
  Serial.print("Device: "); Serial.println(DEVICE_ID);
  
  Serial.println("\nGPIO:");
  Serial.println("MPU SDA: 21\nMPU SCL: 22\nMQ3: 34\nDHT11: 4");
  Serial.println("GPS RX: 16\nGPS TX: 17\nRESET: 26\nRELAY: 23");

  Serial.println("\nSensors:");
  if (mpuInitialize()) {
    mpuInitialized = true;
    Serial.println("MPU6050: OK");
  } else {
    Serial.println("MPU6050: FAIL");
  }

  dht.begin();
  Serial.println("DHT11: OK");
  
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS UART: READY");
  Serial.println("MQ3 ADC: READY");

  Serial.println("\nWiFi:");
  Serial.print("SSID: "); Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("MAC: "); Serial.println(WiFi.macAddress());
  Serial.println("Status: CONNECTING...");

  Serial.println("\nSystem:");
  Serial.println("READY");
  Serial.println("========================================\n");
}

void loop() {
  unsigned long currentMillis = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiRetryTime >= WIFI_RETRY_INTERVAL) {
      lastWiFiRetryTime = currentMillis;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  
  if (currentMillis - lastDhtTime >= DHT_INTERVAL) {
    lastDhtTime = currentMillis;
    currentTemp = dht.readTemperature();
  }

  if (digitalRead(BTN_RESET) == LOW) {
    if (currentMillis - lastResetPress > 5000) {
      lastResetPress = currentMillis;
      sendResetRequest();
    }
  }

  if (currentMillis - lastSensorPostTime >= SENSOR_INTERVAL) {
    lastSensorPostTime = currentMillis;
    
    if (mpuInitialized) {
      mpuReadData();
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      postSensorData();
    } else {
      backendConnected = false;
      
      int localAlcohol = analogRead(MQ3_PIN);
      bool isAlcohol = (localAlcohol > 2000);
      String newStatus = isAlcohol ? "WARNING" : "SAFE";
      currentReason = isAlcohol ? "ALCOHOL (LOCAL)" : "SAFE (LOCAL)";
      engineOn = true;
      processStateTransitions(newStatus, isAlcohol, false);
    }
    printDiagnostics();
  }

  applyPhysicalOutputs(currentMillis);
}

void postSensorData() {
  HTTPClient http;
  http.setTimeout(3000);
  String url = String(API_BASE_URL) + "/api/sensor-data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int alcoholVal = analogRead(MQ3_PIN);
  bool tempValid = !isnan(currentTemp);
  
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["blow_detected"] = false;
  doc["alcohol_value"] = alcoholVal;
  
  if (mpuInitialized) {
    doc["accel_x"] = mpu_ax;
    doc["accel_y"] = mpu_ay;
    doc["accel_z"] = mpu_az;
    doc["gyro_x"] = mpu_gx;
    doc["gyro_y"] = mpu_gy;
    doc["gyro_z"] = mpu_gz;
  } else {
    doc["accel_x"] = 0; doc["accel_y"] = 0; doc["accel_z"] = 0;
    doc["gyro_x"] = 0; doc["gyro_y"] = 0; doc["gyro_z"] = 0;
  }
  
  if (tempValid) {
    doc["temperature"] = currentTemp;
  } else {
    doc["temperature"] = nullptr;
  }

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
      String newStatus = resDoc["status"].as<String>();
      bool isAlcohol = resDoc["alcohol_detected"].as<bool>();
      bool isRash = resDoc["rash_driving_detected"].as<bool>();
      
      currentRisk = resDoc["risk_score"].as<int>();
      engineOn = (resDoc["engine_state"].as<int>() == 1);

      if (alcoholVal > 2000) {
        isAlcohol = true;
        if (newStatus == "SAFE") newStatus = "WARNING";
      }

      if (newStatus == "CRITICAL") currentReason = "ALCOHOL+RASH";
      else if (isAlcohol) currentReason = "ALCOHOL";
      else if (isRash) currentReason = "RASH DRIVING";
      else currentReason = "SAFE";

      processStateTransitions(newStatus, isAlcohol, isRash);
    }
  } else {
    backendConnected = false;
    
    bool isAlcohol = (alcoholVal > 2000);
    String newStatus = isAlcohol ? "WARNING" : "SAFE";
    currentReason = isAlcohol ? "ALCOHOL (LOCAL)" : "SAFE (LOCAL)";
    engineOn = true;
    processStateTransitions(newStatus, isAlcohol, false);
  }
  
  http.end();
}

void processStateTransitions(String newStatus, bool isAlcohol, bool isRash) {
  if (newStatus == "CRITICAL" && previousStatus != "CRITICAL") {
    currentBuzzerMode = BUZZER_CRITICAL;
    buzzerStateTimer = millis();
    buzzerPinState = true;
  } else if (newStatus == "WARNING") {
    if (isAlcohol) {
      if (!previousAlcohol || previousStatus == "CRITICAL") {
        currentBuzzerMode = BUZZER_ALCOHOL;
        buzzerStateTimer = millis();
        buzzerPinState = true;
      }
    } else if (isRash) {
      if (!previousRash || previousStatus == "CRITICAL") {
        currentBuzzerMode = BUZZER_RASH;
        buzzerStateTimer = millis();
        buzzerPinState = true;
      }
    }
  } else if (newStatus == "SAFE") {
    currentBuzzerMode = BUZZER_OFF;
    buzzerPinState = false;
  }

  if (currentBuzzerMode == BUZZER_ALCOHOL && !isAlcohol) {
    currentBuzzerMode = BUZZER_OFF;
  }

  previousStatus = newStatus;
  currentStatus = newStatus;
  previousAlcohol = isAlcohol;
  previousRash = isRash;
}

void sendResetRequest() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.setTimeout(3000);
  String url = String(API_BASE_URL) + "/api/vehicles/" + String(VEHICLE_DB_ID) + "/reset";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST("{}");
  if (httpCode > 0) {
    String responseStr = http.getString();
    StaticJsonDocument<256> resDoc;
    if (!deserializeJson(resDoc, responseStr)) {
      if (resDoc["success"].as<bool>()) {
        currentStatus = "SAFE";
        previousStatus = "SAFE";
        currentRisk = 0;
        engineOn = true;
        currentReason = "SAFE";
        previousAlcohol = false;
        previousRash = false;
        
        currentBuzzerMode = BUZZER_OFF;
        buzzerPinState = false;
      }
    }
  }
  http.end();
}

void applyPhysicalOutputs(unsigned long currentMillis) {
  digitalWrite(LED_WHITE_SYS, HIGH);

  if (currentStatus == "SAFE") {
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_BLUE_WARN, LOW);
    digitalWrite(LED_RED_CRIT, LOW);
    digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
  } else if (currentStatus == "WARNING") {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE_WARN, HIGH);
    digitalWrite(LED_RED_CRIT, LOW);
    digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
  } else if (currentStatus == "CRITICAL") {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_BLUE_WARN, LOW);
    digitalWrite(LED_RED_CRIT, HIGH);
    digitalWrite(PIN_RELAY, RELAY_OFF_LEVEL);
  }

  if (engineOn) {
    digitalWrite(LED_RED_ENG, HIGH);
  } else {
    digitalWrite(LED_RED_ENG, LOW);
  }

  switch (currentBuzzerMode) {
    case BUZZER_OFF:
      buzzerPinState = false;
      break;

    case BUZZER_RASH:
      if (currentMillis - buzzerStateTimer >= 2000) {
        buzzerPinState = false;
        currentBuzzerMode = BUZZER_OFF;
      } else {
        buzzerPinState = true;
      }
      break;

    case BUZZER_ALCOHOL: {
      unsigned long elapsed = currentMillis - buzzerStateTimer;
      unsigned long cycleTime = elapsed % 60000;
      if (cycleTime < 10000) buzzerPinState = true;
      else buzzerPinState = false;
      break;
    }

    case BUZZER_CRITICAL:
      if (currentMillis - buzzerStateTimer >= 15000) {
        buzzerPinState = false;
      } else {
        buzzerPinState = true;
      }
      break;
  }

  digitalWrite(PIN_BUZZER, buzzerPinState ? HIGH : LOW);
}

void printDiagnostics() {
  Serial.print("STATUS="); Serial.print(currentStatus);
  Serial.print(" RISK="); Serial.print(currentRisk);
  Serial.print(" ALCOHOL="); Serial.print(analogRead(MQ3_PIN));
  Serial.print(" TEMP="); Serial.print(isnan(currentTemp) ? 0.0 : currentTemp);
  
  Serial.print(" MPU: AX="); Serial.print(mpu_ax); 
  Serial.print(" AY="); Serial.print(mpu_ay); 
  Serial.print(" AZ="); Serial.print(mpu_az);
  Serial.print(" GX="); Serial.print(mpu_gx); 
  Serial.print(" GY="); Serial.print(mpu_gy); 
  Serial.print(" GZ="); Serial.print(mpu_gz);

  Serial.print(" GPS="); 
  if (gps.location.isValid()) {
    Serial.print(gps.location.lat(), 6); Serial.print(","); Serial.print(gps.location.lng(), 6);
  } else {
    Serial.print("INVALID");
  }
  
  Serial.print(" ENGINE="); Serial.print(engineOn ? "ON" : "OFF");
  Serial.print(" RELAY="); Serial.print((currentStatus == "CRITICAL") ? "OFF" : "ON");
  Serial.print(" BACKEND="); Serial.println(backendConnected ? "ONLINE" : "OFFLINE");
}
