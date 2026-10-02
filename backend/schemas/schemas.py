from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from database.models import SafetyStatus

class SensorDataCreate(BaseModel):
    device_id: str
    alcohol_value: float
    accel_x: float
    accel_y: float
    accel_z: float
    gyro_x: float
    gyro_y: float
    gyro_z: float
    temperature: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    blow_detected: Optional[bool] = False

class SensorDataResponse(BaseModel):
    success: bool
    reading_id: int
    status: str
    risk_score: int
    alcohol_detected: bool
    rash_driving_detected: bool
    engine_state: int
    buzzer_action: int

class VehicleResponse(BaseModel):
    id: int
    device_id: str
    vehicle_name: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class SystemStatusResponse(BaseModel):
    vehicle_id: int
    current_risk_score: int
    current_status: SafetyStatus
    engine_state: str
    buzzer_state: str
    gps_connected: bool
    last_seen: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class RiskEventResponse(BaseModel):
    id: int
    timestamp: datetime
    risk_score: int
    status: SafetyStatus
    reason: str
    alcohol_status: Optional[str]
    rash_driving_status: Optional[str]
    buzzer_action: Optional[str]
    engine_state: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]

    model_config = ConfigDict(from_attributes=True)

class SensorReadingResponse(BaseModel):
    id: int
    timestamp: datetime
    alcohol_value: float
    accel_x: float
    accel_y: float
    accel_z: float
    gyro_x: float
    gyro_y: float
    gyro_z: float
    temperature: float
    latitude: float
    longitude: float

    model_config = ConfigDict(from_attributes=True)

class ResetResponse(BaseModel):
    success: bool
    message: str
    vehicle_id: int
