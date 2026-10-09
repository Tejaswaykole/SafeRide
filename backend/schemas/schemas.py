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
    temperature: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    blow_detected: Optional[bool] = False
    speed: Optional[float] = 0.0
    distance: Optional[float] = 0.0
    critical_active: Optional[bool] = False
    critical_latched: Optional[bool] = False
    critical_timer: Optional[int] = 0
    engine_state: Optional[int] = None
    relay_state: Optional[int] = None
    is_live_gps: Optional[bool] = None

class SensorDataResponse(BaseModel):
    success: bool
    reading_id: int
    status: str
    risk_score: int
    alcohol_detected: bool
    rash_driving_detected: bool
    engine_state: int
    relay_state: int = 1
    buzzer_action: int
    reason: Optional[str] = None
    jerk_percentage: int = 0
    jerk_beeps: int = 0
    speed: float = 0.0
    distance: float = 0.0
    critical_active: bool = False
    critical_latched: bool = False
    critical_timer: int = 0
    admin_cutoff: bool = False
    admin_timer: int = 0
    last_latitude: Optional[float] = None
    last_longitude: Optional[float] = None
    is_last_known_location: bool = False
    server_time_ist: Optional[str] = None
    server_epoch: Optional[int] = None

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
    relay_state: Optional[str] = "ON"
    buzzer_state: str
    gps_connected: bool
    speed: Optional[float] = 0.0
    distance: Optional[float] = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_last_known_location: Optional[bool] = False
    critical_active: Optional[bool] = False
    critical_latched: Optional[bool] = False
    critical_timer: Optional[int] = 0
    admin_cutoff: Optional[bool] = False
    admin_timer: Optional[int] = 0
    server_time_ist: Optional[str] = None
    timestamp_ist: Optional[str] = None
    last_seen: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class LocationSyncRequest(BaseModel):
    latitude: float
    longitude: float

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
    temperature: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class ResetResponse(BaseModel):
    success: bool
    message: str
    vehicle_id: int

class AdminCutoffResponse(BaseModel):
    success: bool
    message: str
    vehicle_id: int
    admin_cutoff: bool
    admin_timer: int

