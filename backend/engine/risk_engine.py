import os
from database.models import SafetyStatus
from schemas.schemas import SensorDataCreate

# Configuration for prototype, can be overridden by env vars
MQ3_BASELINE = float(os.getenv("MQ3_BASELINE", 1000))
MQ3_THRESHOLD = float(os.getenv("MQ3_THRESHOLD", 1150))
ACCEL_CHANGE_THRESHOLD = float(os.getenv("ACCEL_CHANGE_THRESHOLD", 2.5))
GYRO_CHANGE_THRESHOLD = float(os.getenv("GYRO_CHANGE_THRESHOLD", 150.0))

class RiskEngine:
    @staticmethod
    def evaluate(data: SensorDataCreate) -> dict:
        alcohol_detected = False
        rash_driving_detected = False

        # Alcohol Detection Logic
        if data.blow_detected:
            if data.alcohol_value > MQ3_THRESHOLD:
                alcohol_detected = True
        
        # Rash Driving Detection Logic
        # Simplistic logic: check if any acceleration or gyro exceeds threshold abruptly
        accel_abnormal = (abs(data.accel_x) > ACCEL_CHANGE_THRESHOLD or 
                          abs(data.accel_y) > ACCEL_CHANGE_THRESHOLD or 
                          abs(data.accel_z) > (9.8 + ACCEL_CHANGE_THRESHOLD))
                          
        gyro_abnormal = (abs(data.gyro_x) > GYRO_CHANGE_THRESHOLD or 
                         abs(data.gyro_y) > GYRO_CHANGE_THRESHOLD or 
                         abs(data.gyro_z) > GYRO_CHANGE_THRESHOLD)

        if accel_abnormal or gyro_abnormal:
            rash_driving_detected = True

        # Decision Matrix
        risk_score = 0
        status = SafetyStatus.SAFE
        engine_state = 1
        buzzer_action = 0
        reason = "Normal"

        if alcohol_detected and rash_driving_detected:
            status = SafetyStatus.CRITICAL
            risk_score = 60
            engine_state = 0
            buzzer_action = 15
            reason = "ALCOHOL + RASH DRIVING"
        elif alcohol_detected:
            status = SafetyStatus.WARNING
            risk_score = 30
            engine_state = 1
            buzzer_action = 10
            reason = "ALCOHOL DETECTED"
        elif rash_driving_detected:
            status = SafetyStatus.WARNING
            risk_score = 30
            engine_state = 1
            buzzer_action = 2
            reason = "RASH DRIVING DETECTED"

        return {
            "status": status,
            "risk_score": risk_score,
            "alcohol_detected": alcohol_detected,
            "rash_driving_detected": rash_driving_detected,
            "reason": reason,
            "buzzer_action": buzzer_action,
            "engine_state": engine_state
        }
