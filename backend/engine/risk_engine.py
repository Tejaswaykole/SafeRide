import os
import math
from database.models import SafetyStatus
from schemas.schemas import SensorDataCreate

ALCOHOL_SAFE_THRESHOLD = 500
ALCOHOL_WARN_PHASE1_MIN = 500
ALCOHOL_WARN_PHASE1_MAX = 750
ALCOHOL_WARN_PHASE2_MIN = 751
ALCOHOL_WARN_PHASE2_MAX = 1000
ALCOHOL_CRITICAL_THRESHOLD = 1001  # > 1000 is critical
ACCEL_CHANGE_THRESHOLD = 5.0
GYRO_CHANGE_THRESHOLD = 2.0

class RiskEngine:
    @staticmethod
    def evaluate(data: SensorDataCreate) -> dict:
        alcohol_warn_p1 = False
        alcohol_warn_p2 = False
        alcohol_critical = False
        rash_driving_detected = False

        if data.alcohol_value > 1000:
            alcohol_critical = True
        elif 751 <= data.alcohol_value <= 1000:
            alcohol_warn_p2 = True
        elif 500 <= data.alcohol_value <= 750:
            alcohol_warn_p1 = True

        # Rash Driving & Jerk Percentage Calculation Logic
        accel_magnitude = math.sqrt(data.accel_x**2 + data.accel_y**2 + data.accel_z**2)
        accel_delta = abs(accel_magnitude - 9.80665)
        accel_abnormal = accel_delta > ACCEL_CHANGE_THRESHOLD

        max_gyro = max(abs(data.gyro_x), abs(data.gyro_y), abs(data.gyro_z))
        gyro_abnormal = max_gyro > GYRO_CHANGE_THRESHOLD

        jerk_percentage = 0
        jerk_beeps = 0

        if accel_abnormal or gyro_abnormal:
            rash_driving_detected = True
            accel_norm = max(0.0, (accel_delta - ACCEL_CHANGE_THRESHOLD) / 15.0)
            gyro_norm = max(0.0, (max_gyro - GYRO_CHANGE_THRESHOLD) / 4.0)
            intensity = max(accel_norm, gyro_norm)
            # Map intensity to jerk percentage [1% - 100%]
            jerk_percentage = min(100, max(1, int(15 + intensity * 85)))

            # Jerk Beep Mapping: 100 / 5 = 20% steps, max 5 beeps
            # 0-20% -> 1 beep
            # 21-40% -> 2 beeps
            # 41-60% -> 3 beeps
            # 61-80% -> 4 beeps
            # 81-100% -> 5 beeps
            if jerk_percentage <= 20:
                jerk_beeps = 1
            elif jerk_percentage <= 40:
                jerk_beeps = 2
            elif jerk_percentage <= 60:
                jerk_beeps = 3
            elif jerk_percentage <= 80:
                jerk_beeps = 4
            else:
                jerk_beeps = 5

        alcohol_detected_bool = (alcohol_warn_p1 or alcohol_warn_p2 or alcohol_critical)

        # Output Priority:
        # CRITICAL > WARN PHASE 2 > WARN PHASE 1 > RASH WARNING > SAFE
        if alcohol_critical or ((alcohol_warn_p1 or alcohol_warn_p2) and rash_driving_detected):
            status = SafetyStatus.CRITICAL
            risk_score = 85
            engine_state = 1  # Engine stays ON during 1-minute warning countdown; cuts OFF after timer completes
            buzzer_action = 1
            reason = "HEAVY ALCOHOL DETECTED" if alcohol_critical else "ALCOHOL + RASH CRITICAL"
        elif alcohol_warn_p2:
            status = SafetyStatus.WARNING
            risk_score = 60
            engine_state = 1
            buzzer_action = 15
            reason = "ALCOHOL WARN PHASE 2"
        elif alcohol_warn_p1:
            status = SafetyStatus.WARNING
            risk_score = 40
            engine_state = 1
            buzzer_action = 6
            reason = "ALCOHOL WARN PHASE 1"
        elif rash_driving_detected:
            status = SafetyStatus.WARNING
            risk_score = min(max(30 + int(jerk_percentage * 0.4), 30), 75)
            engine_state = 1
            buzzer_action = jerk_beeps
            reason = f"RASH DRIVING ({jerk_percentage}% JERK - {jerk_beeps} BEEP{'S' if jerk_beeps > 1 else ''})"
        else:
            status = SafetyStatus.SAFE
            risk_score = 10
            engine_state = 1
            buzzer_action = 0
            reason = "SAFE"

        return {
            "status": status,
            "risk_score": min(max(risk_score, 0), 100),
            "alcohol_detected": alcohol_detected_bool,
            "rash_driving_detected": rash_driving_detected,
            "jerk_percentage": jerk_percentage,
            "jerk_beeps": jerk_beeps,
            "reason": reason,
            "buzzer_action": buzzer_action,
            "engine_state": engine_state
        }
