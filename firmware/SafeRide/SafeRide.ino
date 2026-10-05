#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==========================================
// OLED CONFIGURATION (Shared I2C: GPIO21/22)
// ==========================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool oledAvailable = false;
unsigned long lastOledUpdate = 0;
int currentOledScreen = 0;

// ==========================================
// NETWORK & BACKEND CONFIGURATION
// ==========================================
const char* WIFI_SSID = "OnePlus Nord CE 3 Lite 5G ";
const char* WIFI_PASSWORD = "tejuuu9011";

const char* API_BASE_URL = "http://10.160.183.135:8000";
const char* DEVICE_ID = "SAFERIDE-001";
const int VEHICLE_DB_ID = 1;

const unsigned long SENSOR_INTERVAL = 500;
const unsigned long WIFI_RETRY_INTERVAL = 5000;
const unsigned long DHT_INTERVAL = 2500;

// ==========================================
// GPIO MAP & POLARITY
// ==========================================
constexpr int MQ3_PIN = 34;          // MQ-3 Alcohol Sensor Analog Output (AO)
constexpr int DHT_PIN = 4;           // DHT11 Data Pin
#define DHTTYPE DHT11
constexpr int GPS_RX_PIN = 16;       // NEO-6M TX -> ESP32 GPIO16
constexpr int GPS_TX_PIN = 17;       // NEO-6M RX -> ESP32 GPIO17
constexpr int BTN_RESET = 26;        // Active-LOW Reset Button

constexpr int LED_GREEN = 25;        // Green SAFE LED
constexpr int LED_BLUE_WARN = 33;    // Blue WARNING LED
constexpr int LED_RED_CRIT = 32;     // Red CRITICAL LED
constexpr int LED_RED_ENG = 13;      // Red ENGINE LED
constexpr int LED_WHITE_SYS = 14;    // White SYSTEM LED
constexpr int PIN_BUZZER = 27;       // Buzzer
constexpr int PIN_RELAY = 23;        // Engine Cutoff Relay

constexpr int RELAY_ON_LEVEL = HIGH;
constexpr int RELAY_OFF_LEVEL = LOW;

// ==========================================
// STATE MACHINE ENUMS & NAMED CONSTANTS
// ==========================================
// Output Priority: RESET > CRITICAL > HIGH WARNING > WARNING > RASH WARNING > SAFE
enum SafetyState {
  STATE_SAFE,
  STATE_RASH_WARNING,
  STATE_ALCOHOL_WARNING,
  STATE_ALCOHOL_HIGH_WARNING,
  STATE_CRITICAL
};

enum CriticalPhase {
  CRIT_PHASE_NONE = 0,
  CRIT_PHASE_1 = 1,  // 0 to 15s: 2 beeps/sec, Red LED fast blink, Relay ON, Engine ON
  CRIT_PHASE_2 = 2,  // 15 to 30s: Quiet period (buzzer OFF), Red LED fast blink, Relay ON, Engine ON
  CRIT_PHASE_3 = 3,  // 30 to 45s: 2 beeps/sec, Red LED fast blink, Relay ON, Engine ON
  CRIT_PHASE_4 = 4,  // 45 to 60s: Continuous buzzer, Red LED fast blink, Relay ON, Engine ON
  CRIT_PHASE_5 = 5   // 60s+: Engine OFF, Relay OFF, Latched critical state, Buzzer OFF
};

enum BuzzerMode {
  BUZZER_OFF,
  BUZZER_RASH,                   // 4 beeps (400ms ON / 600ms OFF)
  BUZZER_ALCOHOL_WARNING,        // 6 beeps (400ms ON / 600ms OFF)
  BUZZER_ALCOHOL_HIGH_WARNING,   // 15 beeps (400ms ON / 600ms OFF)
  BUZZER_CRITICAL_DOUBLE_BEEP,   // 2 beeps/sec (400ms ON, 100ms OFF, 400ms ON, 100ms OFF)
  BUZZER_CRITICAL_CONTINUOUS     // Continuous ON
};

// Prototype Raw ADC Thresholds (NOT legal BAC)
constexpr int ALCOHOL_SAFE_THRESHOLD = 600;           // < 600: SAFE
constexpr int ALCOHOL_WARNING_THRESHOLD = 600;        // 600 - 1000: WARNING
constexpr int ALCOHOL_HIGH_WARNING_THRESHOLD = 1001;   // 1001 - 1500: HIGH WARNING
constexpr int ALCOHOL_CRITICAL_THRESHOLD = 1501;       // > 1500 (>= 1501): CRITICAL

// Critical 5-Phase Timing Constants (milliseconds)
constexpr unsigned long CRITICAL_PHASE_1_END = 15000;
constexpr unsigned long CRITICAL_PHASE_2_END = 30000;
constexpr unsigned long CRITICAL_PHASE_3_END = 45000;
constexpr unsigned long CRITICAL_PHASE_4_END = 60000;
constexpr unsigned long CRITICAL_TOTAL_TIME  = 60000;

// Rash Driving Calibrated Thresholds
constexpr float ACCEL_CHANGE_THRESHOLD = 5.0f;
constexpr float GYRO_CHANGE_THRESHOLD = 2.0f;

// ==========================================
// SYSTEM STATE VARIABLES
// ==========================================
SafetyState currentSafetyState = STATE_SAFE;
SafetyState previousSafetyState = STATE_SAFE;

CriticalPhase currentCriticalPhase = CRIT_PHASE_NONE;
unsigned long criticalStartTime = 0;
bool criticalActive = false;
bool criticalLatched = false;

BuzzerMode currentBuzzerMode = BUZZER_OFF;
unsigned long buzzerStartTime = 0;
bool buzzerPinState = false;

String currentStatus = "SAFE";
String previousStatus = "SAFE";
int currentRisk = 0;
bool engineOn = true;
String currentReason = "SAFE";
bool backendConnected = false;

unsigned long lastResetPress = 0;
unsigned long lastSensorPostTime = 0;
unsigned long lastWiFiRetryTime = 0;
unsigned long lastDhtTime = 0;

// ==========================================
// SENSOR OBJECTS & DATA
// ==========================================
DHT dht(DHT_PIN, DHTTYPE);
float currentTemp = NAN;

String gpsLine = "";
float gpsLat = 0.0;
float gpsLon = 0.0;
bool gpsValid = false;
HardwareSerial gpsSerial(2);

bool mpuInitialized = false;
float mpu_ax = 0, mpu_ay = 0, mpu_az = 0;
float mpu_gx = 0, mpu_gy = 0, mpu_gz = 0;

// ==========================================
// FORWARD DECLARATIONS
// ==========================================
void evaluateSafetyState();
void applyPhysicalOutputs(unsigned long currentMillis);
void performSystemReset();
void updateOLED(unsigned long currentMillis);
void postSensorData();
void sendResetRequest();
void printDiagnostics();
bool mpuInitialize();
void mpuReadData();

// ==========================================
// MPU6050 RAW I2C DRIVER (Address 0x68)
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
  Wire.requestFrom(0x68, (uint8_t)1, (uint8_t)true);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0;
}

bool mpuInitialize() {
  uint8_t whoami = mpuReadRegister(0x75);
  Serial.print("MPU6050 WHO_AM_I: 0x"); Serial.println(whoami, HEX);
  
  // Wake up MPU6050
  mpuWriteRegister(0x6B, 0x00);
  delay(50);
  
  if (whoami == 0 || whoami == 0xFF) {
    return false; // I2C unresponsive
  }

  // Accel config: 8g (4096 LSB/g)
  mpuWriteRegister(0x1C, 0x10);
  // Gyro config: 500 deg/s (65.5 LSB/deg/s)
  mpuWriteRegister(0x1B, 0x08);
  return true;
}

void mpuReadData() {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(0x68, (uint8_t)14, (uint8_t)true);
  
  if (Wire.available() >= 14) {
    uint8_t buf[14];
    for (int i = 0; i < 14; i++) {
      buf[i] = Wire.read();
    }
    
    int16_t raw_ax = (buf[0] << 8) | buf[1];
    int16_t raw_ay = (buf[2] << 8) | buf[3];
    int16_t raw_az = (buf[4] << 8) | buf[5];
    int16_t raw_gx = (buf[8] << 8) | buf[9];
    int16_t raw_gy = (buf[10] << 8) | buf[11];
    int16_t raw_gz = (buf[12] << 8) | buf[13];
    
    mpu_ax = (raw_ax / 4096.0f) * 9.80665f;
    mpu_ay = (raw_ay / 4096.0f) * 9.80665f;
    mpu_az = (raw_az / 4096.0f) * 9.80665f;
    
    mpu_gx = (raw_gx / 65.5f) * 0.0174533f; 
    mpu_gy = (raw_gy / 65.5f) * 0.0174533f;
    mpu_gz = (raw_gz / 65.5f) * 0.0174533f;
  }
}

// ==========================================
// SETUP
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

  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_BLUE_WARN, LOW);
  digitalWrite(LED_RED_CRIT, LOW);
  digitalWrite(LED_RED_ENG, HIGH);
  digitalWrite(LED_WHITE_SYS, HIGH); 
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);

  Serial.println("\n========================================");
  Serial.println("SafeRide ESP32 Safety System");
  Serial.println("========================================");
  Serial.print("Device ID: "); Serial.println(DEVICE_ID);
  
  // Shared I2C Bus on GPIO21 (SDA) and GPIO22 (SCL)
  Wire.begin(21, 22);
  Wire.setClock(100000);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 OLED allocation failed (continuing without display)"));
  } else {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("SafeRide Safety Sys");
    display.println("Initializing...");
    display.display();
    Serial.println("OLED: OK (0x3C)");
  }

  if (mpuInitialize()) {
    mpuInitialized = true;
    Serial.println("MPU6050: OK (0x68)");
  } else {
    Serial.println("MPU6050: NOT DETECTED (System will run without rash detection)");
  }

  dht.begin();
  Serial.println("DHT11: OK");
  
  gpsSerial.setRxBufferSize(2048);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("NEO-6M GPS UART2: READY (9600 baud)");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi connecting to: "); Serial.println(WIFI_SSID);

  Serial.println("SafeRide Firmware Initialized & READY.\n");
}

// ==========================================
// MAIN LOOP (Fully Non-Blocking)
// ==========================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Maintain Wi-Fi Connection Asynchronously
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiRetryTime >= WIFI_RETRY_INTERVAL) {
      lastWiFiRetryTime = currentMillis;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  // 2. Continuous GPS NMEA Processing (UART2)
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    if (c == '\n') {
      if (gpsLine.startsWith("$GPRMC")) {
        int p1 = gpsLine.indexOf(',');
        int p2 = gpsLine.indexOf(',', p1 + 1);
        int p3 = gpsLine.indexOf(',', p2 + 1);
        int p4 = gpsLine.indexOf(',', p3 + 1);
        int p5 = gpsLine.indexOf(',', p4 + 1);
        int p6 = gpsLine.indexOf(',', p5 + 1);
        int p7 = gpsLine.indexOf(',', p6 + 1);

        if (p7 > 0) {
          String status = gpsLine.substring(p2 + 1, p3);
          if (status == "A") {
            String lat = gpsLine.substring(p3 + 1, p4);
            String ns  = gpsLine.substring(p4 + 1, p5);
            String lon = gpsLine.substring(p5 + 1, p6);
            String ew  = gpsLine.substring(p6 + 1, p7);

            float rawLat = lat.toFloat();
            float rawLon = lon.toFloat();

            int latDeg = rawLat / 100;
            float latMin = rawLat - (latDeg * 100);
            gpsLat = latDeg + latMin / 60.0f;

            int lonDeg = rawLon / 100;
            float lonMin = rawLon - (lonDeg * 100);
            gpsLon = lonDeg + lonMin / 60.0f;

            if (ns == "S") gpsLat = -gpsLat;
            if (ew == "W") gpsLon = -gpsLon;
            
            gpsValid = true;
          } else {
            gpsValid = false;
          }
        }
      }
      gpsLine = "";
    } else if (c != '\r') {
      gpsLine += c;
      if (gpsLine.length() > 150) gpsLine = "";
    }
  }

  // 3. Periodic DHT11 Temperature Read
  if (currentMillis - lastDhtTime >= DHT_INTERVAL) {
    lastDhtTime = currentMillis;
    currentTemp = dht.readTemperature();
  }

  // 4. RESET Button (Highest Priority, Instant Non-Blocking Response)
  if (digitalRead(BTN_RESET) == LOW) {
    if (currentMillis - lastResetPress > 1000) {
      lastResetPress = currentMillis;
      performSystemReset();
    }
  }

  // 5. Periodic Sensor Read & Decision Engine
  if (currentMillis - lastSensorPostTime >= SENSOR_INTERVAL) {
    lastSensorPostTime = currentMillis;
    
    if (mpuInitialized) {
      mpuReadData();
    }

    // Always run deterministic local safety engine
    evaluateSafetyState();
    
    // Post to backend if Wi-Fi connected
    if (WiFi.status() == WL_CONNECTED) {
      postSensorData();
    } else {
      backendConnected = false;
    }
    
    printDiagnostics();
  }

  // 6. Real-Time Centralized Hardware Output Controller
  applyPhysicalOutputs(currentMillis);

  // 7. Asynchronous OLED Display Updates
  updateOLED(currentMillis);
}

// ==========================================
// CENTRALIZED SAFETY EVALUATION LOGIC
// ==========================================
void evaluateSafetyState() {
  int alcoholVal = analogRead(MQ3_PIN);
  
  // Rash driving calculation based on calibrated 3D magnitude & gyro
  bool rashDetected = false;
  if (mpuInitialized) {
    float mag = sqrt(mpu_ax * mpu_ax + mpu_ay * mpu_ay + mpu_az * mpu_az);
    bool accelAbnormal = (abs(mag - 9.80665f) > ACCEL_CHANGE_THRESHOLD);
    bool gyroAbnormal = (abs(mpu_gx) > GYRO_CHANGE_THRESHOLD ||
                         abs(mpu_gy) > GYRO_CHANGE_THRESHOLD ||
                         abs(mpu_gz) > GYRO_CHANGE_THRESHOLD);
    rashDetected = (accelAbnormal || gyroAbnormal);
  }

  // CASE: Latched critical state (Phase 5). Only RESET clears this!
  if (criticalLatched) {
    currentSafetyState = STATE_CRITICAL;
    currentCriticalPhase = CRIT_PHASE_5;
    currentStatus = "CRITICAL";
    currentRisk = 85;
    engineOn = false;
    currentReason = "CRITICAL ENGINE SHUTDOWN";
    currentBuzzerMode = BUZZER_OFF;
    return;
  }

  // CASE: Critical sequence currently running (Phases 1-4)
  if (criticalActive) {
    unsigned long elapsed = millis() - criticalStartTime;
    currentSafetyState = STATE_CRITICAL;
    currentStatus = "CRITICAL";
    currentRisk = 85;
    
    if (elapsed < CRITICAL_PHASE_1_END) {
      currentCriticalPhase = CRIT_PHASE_1;
      currentBuzzerMode = BUZZER_CRITICAL_DOUBLE_BEEP;
      currentReason = "HEAVY ALCOHOL (PHASE 1)";
      engineOn = true;
    } else if (elapsed < CRITICAL_PHASE_2_END) {
      currentCriticalPhase = CRIT_PHASE_2;
      currentBuzzerMode = BUZZER_OFF;
      currentReason = "HEAVY ALCOHOL (PHASE 2 - QUIET)";
      engineOn = true;
    } else if (elapsed < CRITICAL_PHASE_3_END) {
      currentCriticalPhase = CRIT_PHASE_3;
      currentBuzzerMode = BUZZER_CRITICAL_DOUBLE_BEEP;
      currentReason = "HEAVY ALCOHOL (PHASE 3)";
      engineOn = true;
    } else if (elapsed < CRITICAL_PHASE_4_END) {
      currentCriticalPhase = CRIT_PHASE_4;
      currentBuzzerMode = BUZZER_CRITICAL_CONTINUOUS;
      currentReason = "HEAVY ALCOHOL (PHASE 4 - WARNING)";
      engineOn = true;
    } else {
      // 60 seconds reached! Move to Phase 5
      currentCriticalPhase = CRIT_PHASE_5;
      criticalLatched = true;
      criticalActive = false;
      engineOn = false;
      currentBuzzerMode = BUZZER_OFF;
      currentReason = "CRITICAL ENGINE SHUTDOWN";
    }
    return;
  }

  // EVALUATION BASED ON STRICT SAFETY PRIORITY:
  // CRITICAL > HIGH WARNING > WARNING > RASH WARNING > SAFE
  bool alcoholWarningCondition = (alcoholVal >= ALCOHOL_WARNING_THRESHOLD); // >= 600
  bool isCriticalTrigger = (alcoholVal >= ALCOHOL_CRITICAL_THRESHOLD) || (alcoholWarningCondition && rashDetected);

  if (isCriticalTrigger) {
    // Start critical sequence ONCE
    criticalActive = true;
    criticalStartTime = millis();
    currentCriticalPhase = CRIT_PHASE_1;
    currentSafetyState = STATE_CRITICAL;
    currentStatus = "CRITICAL";
    currentRisk = 85;
    engineOn = true;
    currentBuzzerMode = BUZZER_CRITICAL_DOUBLE_BEEP;
    currentReason = (alcoholVal >= ALCOHOL_CRITICAL_THRESHOLD) ? "HEAVY ALCOHOL DETECTED" : "ALCOHOL + RASH CRITICAL";
  } else if (alcoholVal >= ALCOHOL_HIGH_WARNING_THRESHOLD) { // 1001 - 1500
    currentSafetyState = STATE_ALCOHOL_HIGH_WARNING;
    currentStatus = "WARNING";
    currentRisk = 55;
    engineOn = true;
    currentReason = "HIGH ALCOHOL WARNING";
    if (previousSafetyState != STATE_ALCOHOL_HIGH_WARNING) {
      currentBuzzerMode = BUZZER_ALCOHOL_HIGH_WARNING;
      buzzerStartTime = millis();
    }
  } else if (alcoholVal >= ALCOHOL_WARNING_THRESHOLD) { // 600 - 1000
    currentSafetyState = STATE_ALCOHOL_WARNING;
    currentStatus = "WARNING";
    currentRisk = 40;
    engineOn = true;
    currentReason = "ALCOHOL WARNING";
    if (previousSafetyState != STATE_ALCOHOL_WARNING) {
      currentBuzzerMode = BUZZER_ALCOHOL_WARNING;
      buzzerStartTime = millis();
    }
  } else if (rashDetected || (currentBuzzerMode == BUZZER_RASH && (millis() - buzzerStartTime < 4000))) {
    currentSafetyState = STATE_RASH_WARNING;
    currentStatus = "WARNING";
    currentRisk = 40;
    engineOn = true;
    currentReason = "RASH DRIVING DETECTED";
    if (previousSafetyState != STATE_RASH_WARNING && currentBuzzerMode != BUZZER_RASH) {
      currentBuzzerMode = BUZZER_RASH;
      buzzerStartTime = millis();
    }
  } else {
    // SAFE (< 600 and no rash)
    currentSafetyState = STATE_SAFE;
    currentStatus = "SAFE";
    currentRisk = 10;
    engineOn = true;
    currentReason = "SAFE";
    currentBuzzerMode = BUZZER_OFF;
    buzzerPinState = false;
  }

  previousSafetyState = currentSafetyState;
}

// ==========================================
// CENTRALIZED PHYSICAL OUTPUT CONTROLLER
// ==========================================
void applyPhysicalOutputs(unsigned long currentMillis) {
  // White System LED: Always ON
  digitalWrite(LED_WHITE_SYS, HIGH);

  // Red Engine LED: Tracks engine state
  digitalWrite(LED_RED_ENG, engineOn ? HIGH : LOW);

  // State-specific LED and Relay behavior
  switch (currentSafetyState) {
    case STATE_SAFE:
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_BLUE_WARN, LOW);
      digitalWrite(LED_RED_CRIT, LOW);
      digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
      break;

    case STATE_RASH_WARNING:
      digitalWrite(LED_GREEN, LOW);
      digitalWrite(LED_BLUE_WARN, HIGH); // Solid ON
      digitalWrite(LED_RED_CRIT, LOW);
      digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
      break;

    case STATE_ALCOHOL_WARNING:
      digitalWrite(LED_GREEN, LOW);
      digitalWrite(LED_BLUE_WARN, HIGH); // Solid ON
      digitalWrite(LED_RED_CRIT, LOW);
      digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
      break;

    case STATE_ALCOHOL_HIGH_WARNING:
      digitalWrite(LED_GREEN, LOW);
      // Blue WARNING LED = BLINK (250ms ON / 250ms OFF)
      digitalWrite(LED_BLUE_WARN, ((currentMillis / 250) % 2 == 0) ? HIGH : LOW);
      digitalWrite(LED_RED_CRIT, LOW);
      digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
      break;

    case STATE_CRITICAL:
      digitalWrite(LED_GREEN, LOW);
      digitalWrite(LED_BLUE_WARN, LOW);
      
      if (currentCriticalPhase == CRIT_PHASE_5) {
        // Phase 5: Engine OFF, Relay OFF, Red CRITICAL LED remains in critical indication
        digitalWrite(PIN_RELAY, RELAY_OFF_LEVEL);
        digitalWrite(LED_RED_CRIT, HIGH);
      } else {
        // Phases 1-4: Relay ON, Engine ON, Red CRITICAL LED = 4 blinks every 3 seconds
        digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
        unsigned long cycle = currentMillis % 3000;
        // 4 distinct blinks within 1600ms (200ms ON / 200ms OFF), then 1400ms pause
        bool redBlink = (cycle < 1600) && ((cycle % 400) < 200);
        digitalWrite(LED_RED_CRIT, redBlink ? HIGH : LOW);
      }
      break;
  }

  // Centralized Buzzer State Machine (NO delay())
  switch (currentBuzzerMode) {
    case BUZZER_OFF:
      buzzerPinState = false;
      break;

    case BUZZER_RASH: {
      // 4 beeps: 400ms ON / 600ms OFF (total 4000ms = 4.0s)
      unsigned long elapsed = currentMillis - buzzerStartTime;
      if (elapsed < 4000) {
        unsigned long cycleMs = elapsed % 1000;
        buzzerPinState = (cycleMs < 400);
      } else {
        buzzerPinState = false;
        currentBuzzerMode = BUZZER_OFF;
      }
      break;
    }

    case BUZZER_ALCOHOL_WARNING: {
      // 6 beeps: 400ms ON / 600ms OFF (total 6000ms = 6.0s)
      unsigned long elapsed = currentMillis - buzzerStartTime;
      if (elapsed < 6000) {
        unsigned long cycleMs = elapsed % 1000;
        buzzerPinState = (cycleMs < 400);
      } else {
        buzzerPinState = false;
        currentBuzzerMode = BUZZER_OFF;
      }
      break;
    }

    case BUZZER_ALCOHOL_HIGH_WARNING: {
      // 15 beeps: 400ms ON / 600ms OFF (total 15000ms = 15.0s)
      unsigned long elapsed = currentMillis - buzzerStartTime;
      if (elapsed < 15000) {
        unsigned long cycleMs = elapsed % 1000;
        buzzerPinState = (cycleMs < 400);
      } else {
        buzzerPinState = false;
        currentBuzzerMode = BUZZER_OFF;
      }
      break;
    }

    case BUZZER_CRITICAL_DOUBLE_BEEP: {
      // 2 beeps per second: 400ms ON, 100ms OFF, 400ms ON, 100ms OFF (synchronized with criticalStartTime)
      unsigned long elapsed = currentMillis - criticalStartTime;
      unsigned long cycleMs = elapsed % 1000;
      buzzerPinState = (cycleMs < 400) || (cycleMs >= 500 && cycleMs < 900);
      break;
    }

    case BUZZER_CRITICAL_CONTINUOUS: {
      // Phase 4: Continuous buzzer ON
      buzzerPinState = true;
      break;
    }
  }

  digitalWrite(PIN_BUZZER, buzzerPinState ? HIGH : LOW);
}

// ==========================================
// SYSTEM RESET (Highest Priority)
// ==========================================
void performSystemReset() {
  Serial.println("\n>>> [RESET] System State Reset Triggered <<<");
  
  // 1. Stop buzzer immediately and cancel active buzzer sequence
  currentBuzzerMode = BUZZER_OFF;
  buzzerPinState = false;
  digitalWrite(PIN_BUZZER, LOW);
  buzzerStartTime = 0;
  
  // 2. Cancel critical timer, clear critical phase, and clear critical latch
  criticalActive = false;
  criticalLatched = false;
  criticalStartTime = 0;
  currentCriticalPhase = CRIT_PHASE_NONE;
  
  // 3. Reset warning sequence states and counters
  previousSafetyState = STATE_SAFE;
  currentSafetyState = STATE_SAFE;
  
  // 4. Relay = ON, Engine = ON
  engineOn = true;
  digitalWrite(PIN_RELAY, RELAY_ON_LEVEL);
  digitalWrite(LED_RED_ENG, HIGH);
  
  // 5. System status reset
  currentStatus = "SAFE";
  previousStatus = "SAFE";
  currentRisk = 0;
  currentReason = "SYSTEM RESET";
  
  // 6. OLED returns to normal screen cycle
  currentOledScreen = 0;
  
  // 7. Notify backend reset endpoint asynchronously (non-blocking, keeps history)
  if (WiFi.status() == WL_CONNECTED) {
    sendResetRequest();
  }
  
  // 8. Immediately evaluate current sensor values.
  // If alcohol is still > 1500, start a brand-new critical event.
  // If alcohol is in warning range, establish state without resuming/restarting cancelled buzzer.
  int alcoholVal = analogRead(MQ3_PIN);
  if (alcoholVal >= ALCOHOL_CRITICAL_THRESHOLD) {
    evaluateSafetyState();
  } else if (alcoholVal >= ALCOHOL_HIGH_WARNING_THRESHOLD) {
    currentSafetyState = STATE_ALCOHOL_HIGH_WARNING;
    previousSafetyState = STATE_ALCOHOL_HIGH_WARNING;
    currentStatus = "WARNING";
    currentRisk = 55;
    currentBuzzerMode = BUZZER_OFF;
    buzzerPinState = false;
  } else if (alcoholVal >= ALCOHOL_WARNING_THRESHOLD) {
    currentSafetyState = STATE_ALCOHOL_WARNING;
    previousSafetyState = STATE_ALCOHOL_WARNING;
    currentStatus = "WARNING";
    currentRisk = 40;
    currentBuzzerMode = BUZZER_OFF;
    buzzerPinState = false;
  } else {
    currentSafetyState = STATE_SAFE;
    previousSafetyState = STATE_SAFE;
    currentStatus = "SAFE";
    currentRisk = 10;
    currentBuzzerMode = BUZZER_OFF;
    buzzerPinState = false;
  }
}

// ==========================================
// OLED DISPLAY (Non-Blocking)
// ==========================================
void updateOLED(unsigned long currentMillis) {
  if (!oledAvailable) return;
  if (currentMillis - lastOledUpdate < 250) return;
  lastOledUpdate = currentMillis;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // During CRITICAL states, critical messages override normal screen cycle
  if (currentSafetyState == STATE_CRITICAL) {
    int remainingSec = 0;
    if (criticalActive) {
      unsigned long elapsed = currentMillis - criticalStartTime;
      if (elapsed < CRITICAL_TOTAL_TIME) {
        remainingSec = (CRITICAL_TOTAL_TIME - elapsed) / 1000;
      }
    }

    if (currentCriticalPhase >= CRIT_PHASE_1 && currentCriticalPhase <= CRIT_PHASE_3) {
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("HEAVY ALCOHOL");
      display.println("DETECTED");
      display.println();
      display.println("PARK VEHICLE");
      display.println("AT SAFE LOCATION");
      display.println();
      display.setTextSize(2);
      display.print("TIME: "); display.println(remainingSec);
    } else if (currentCriticalPhase == CRIT_PHASE_4) {
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("HEAVY ALCOHOL");
      display.println("DETECTED");
      display.println();
      display.print("ENGINE SHUTDOWN");
      display.print(" IN: "); display.print(remainingSec); display.println("S");
      display.println();
      display.setTextSize(2);
      display.print("TIME: "); display.println(remainingSec);
    } else if (currentCriticalPhase == CRIT_PHASE_5) {
      display.setTextSize(2);
      display.setCursor(0, 0);
      display.println("ENGINE OFF");
      display.setTextSize(1);
      display.println();
      display.println("HEAVY ALCOHOL");
      display.println("DETECTED");
      display.println();
      display.setTextSize(2);
      display.println("PRESS RESET");
    }
    display.display();
    return;
  }

  // Normal Screen Cycle (Rotates every 3 seconds)
  static unsigned long lastScreenCycle = 0;
  if (currentMillis - lastScreenCycle >= 3000) {
    lastScreenCycle = currentMillis;
    currentOledScreen = (currentOledScreen + 1) % 6;
  }

  display.setCursor(0, 0);

  if (currentOledScreen == 0) {
    // Screen 1: System Info
    display.setTextSize(2);
    display.println("SafeRide");
    display.setTextSize(1);
    display.println();
    display.println(WiFi.status() == WL_CONNECTED ? "WiFi: ONLINE" : "WiFi: OFFLINE");
    display.println(backendConnected ? "Backend: ONLINE" : "Backend: OFFLINE");
    display.println(mpuInitialized ? "MPU6050: ONLINE" : "MPU6050: OFFLINE");
  } else if (currentOledScreen == 1) {
    // Screen 2: Risk Info
    display.setTextSize(2);
    display.println("RISK");
    display.println(currentStatus);
    display.print(currentRisk); display.println("/100");
  } else if (currentOledScreen == 2) {
    // Screen 3: Alcohol Info
    int val = analogRead(MQ3_PIN);
    display.setTextSize(1);
    display.println("ALCOHOL SENSOR");
    display.setTextSize(2);
    display.print("RAW: "); display.println(val);
    if (val >= ALCOHOL_CRITICAL_THRESHOLD) display.println("CRITICAL");
    else if (val >= ALCOHOL_HIGH_WARNING_THRESHOLD) display.println("HIGH WARN");
    else if (val >= ALCOHOL_WARNING_THRESHOLD) display.println("WARNING");
    else display.println("SAFE");
  } else if (currentOledScreen == 3) {
    // Screen 4: Motion Info
    display.setTextSize(2);
    display.println("MOTION");
    display.setTextSize(1);
    display.print("AX: "); display.println(mpu_ax, 2);
    display.print("AY: "); display.println(mpu_ay, 2);
    display.print("AZ: "); display.println(mpu_az, 2);
  } else if (currentOledScreen == 4) {
    // Screen 5: GPS Info
    display.setTextSize(2);
    display.println("GPS");
    display.setTextSize(1);
    display.println(gpsValid ? "STATUS: FIX" : "STATUS: NO FIX");
    if (gpsValid) {
      display.print("LAT: "); display.println(gpsLat, 4);
      display.print("LON: "); display.println(gpsLon, 4);
    } else {
      display.println("LOC: UNAVAILABLE");
    }
  } else if (currentOledScreen == 5) {
    // Screen 6: Engine Info
    display.setTextSize(2);
    display.println("ENGINE");
    display.print("ENG: "); display.println(engineOn ? "ON" : "OFF");
    display.print("RLY: "); display.println(digitalRead(PIN_RELAY) == RELAY_ON_LEVEL ? "ON" : "OFF");
  }

  display.display();
}

// ==========================================
// BACKEND API COMMUNICATION (Non-Blocking)
// ==========================================
void postSensorData() {
  HTTPClient http;
  http.setTimeout(2500);
  String url = String(API_BASE_URL) + "/api/sensor-data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int alcoholVal = analogRead(MQ3_PIN);
  bool tempValid = !isnan(currentTemp);
  
  JsonDocument doc;
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

  if (gpsValid) {
    doc["latitude"] = gpsLat;
    doc["longitude"] = gpsLon;
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
    
    JsonDocument resDoc;
    DeserializationError err = deserializeJson(resDoc, responseStr);
    
    if (!err) {
      int score = resDoc["risk_score"].as<int>();
      if (!criticalLatched && !criticalActive) {
        currentRisk = score;
      }
    }
  } else {
    backendConnected = false;
  }
  
  http.end();
}

void sendResetRequest() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.setTimeout(2000);
  String url = String(API_BASE_URL) + "/api/vehicles/" + String(VEHICLE_DB_ID) + "/reset";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.POST("{}");
  http.end();
}

// ==========================================
// DIAGNOSTIC SERIAL LOGGING
// ==========================================
void printDiagnostics() {
  Serial.print("STATUS="); Serial.print(currentStatus);
  Serial.print(" STATE="); Serial.print(currentSafetyState);
  if (currentSafetyState == STATE_CRITICAL) {
    Serial.print(" PHASE="); Serial.print(currentCriticalPhase);
  }
  Serial.print(" RISK="); Serial.print(currentRisk);
  Serial.print(" ALCOHOL="); Serial.print(analogRead(MQ3_PIN));
  Serial.print(" TEMP="); Serial.print(isnan(currentTemp) ? 0.0f : currentTemp);
  
  Serial.print(" MPU: AX="); Serial.print(mpu_ax); 
  Serial.print(" AY="); Serial.print(mpu_ay); 
  Serial.print(" AZ="); Serial.print(mpu_az); 
  Serial.print(" GX="); Serial.print(mpu_gx); 
  Serial.print(" GY="); Serial.print(mpu_gy); 
  Serial.print(" GZ="); Serial.print(mpu_gz); 

  Serial.print(" GPS="); 
  if (gpsValid) {
    Serial.print(gpsLat, 6); Serial.print(","); Serial.print(gpsLon, 6);
  } else {
    Serial.print("INVALID");
  }
  
  Serial.print(" ENGINE="); Serial.print(engineOn ? "ON" : "OFF");
  Serial.print(" RELAY="); Serial.print((digitalRead(PIN_RELAY) == RELAY_ON_LEVEL) ? "ON" : "OFF");
  Serial.print(" BUZZER_MODE="); Serial.print(currentBuzzerMode);
  Serial.print(" BACKEND="); Serial.println(backendConnected ? "ONLINE" : "OFFLINE");
}
