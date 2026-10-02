from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.deps import get_db
from database.models import Vehicle, SystemStatus, RiskEvent, SensorReading, SafetyStatus
from schemas.schemas import (
    SensorDataCreate, SensorDataResponse, VehicleResponse, 
    SystemStatusResponse, RiskEventResponse, SensorReadingResponse, ResetResponse
)

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "SafeRide API"}

@router.get("/vehicles", response_model=list[VehicleResponse])
def get_vehicles(db: Session = Depends(get_db)):
    return db.query(Vehicle).all()

@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@router.get("/vehicles/{vehicle_id}/status", response_model=SystemStatusResponse)
def get_vehicle_status(vehicle_id: int, db: Session = Depends(get_db)):
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="System status not found for vehicle")
    return status

@router.get("/vehicles/{vehicle_id}/events", response_model=list[RiskEventResponse])
def get_vehicle_events(vehicle_id: int, limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    events = db.query(RiskEvent).filter(RiskEvent.vehicle_id == vehicle_id)\
               .order_by(RiskEvent.created_at.desc())\
               .offset(offset).limit(limit).all()
    # Map created_at to timestamp for schema
    for e in events:
        e.timestamp = e.created_at
    return events

@router.get("/vehicles/{vehicle_id}/sensor-readings", response_model=list[SensorReadingResponse])
def get_vehicle_readings(vehicle_id: int, limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    readings = db.query(SensorReading).filter(SensorReading.vehicle_id == vehicle_id)\
                 .order_by(SensorReading.created_at.desc())\
                 .offset(offset).limit(limit).all()
    # Map created_at to timestamp for schema
    for r in readings:
        r.timestamp = r.created_at
    return readings

@router.post("/sensor-data", response_model=SensorDataResponse)
def ingest_sensor_data(data: SensorDataCreate, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.device_id == data.device_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    reading = SensorReading(
        vehicle_id=vehicle.id,
        alcohol_value=data.alcohol_value,
        accel_x=data.accel_x, accel_y=data.accel_y, accel_z=data.accel_z,
        gyro_x=data.gyro_x, gyro_y=data.gyro_y, gyro_z=data.gyro_z,
        temperature=data.temperature,
        latitude=data.latitude, longitude=data.longitude
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    
    return SensorDataResponse(success=True, message="Sensor data received", reading_id=reading.id)

@router.post("/vehicles/{vehicle_id}/reset", response_model=ResetResponse)
def reset_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="System status not found for vehicle")

    # Reset foundation
    status.current_risk_score = 0
    status.current_status = SafetyStatus.SAFE
    status.engine_state = "ON"
    status.buzzer_state = "OFF"
    
    db.commit()
    
    return ResetResponse(success=True, message="Vehicle status reset successfully", vehicle_id=vehicle_id)
