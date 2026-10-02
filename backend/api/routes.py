from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
from database.deps import get_db
from database.models import Vehicle, SystemStatus, RiskEvent, SensorReading, SafetyStatus
from schemas.schemas import (
    SensorDataCreate, SensorDataResponse, VehicleResponse, 
    SystemStatusResponse, RiskEventResponse, SensorReadingResponse, ResetResponse
)
from engine.risk_engine import RiskEngine
from api.websocket import manager

router = APIRouter()

@router.websocket("/ws/{vehicle_id}")
async def websocket_endpoint(websocket: WebSocket, vehicle_id: str):
    await manager.connect(websocket, vehicle_id)
    try:
        while True:
            # Keep connection alive, though we only push from backend to client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, vehicle_id)

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
def ingest_sensor_data(data: SensorDataCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.device_id == data.device_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    reading = SensorReading(
        vehicle_id=vehicle.id,
        alcohol_value=data.alcohol_value,
        accel_x=data.accel_x, accel_y=data.accel_y, accel_z=data.accel_z,
        gyro_x=data.gyro_x, gyro_y=data.gyro_y, gyro_z=data.gyro_z,
        temperature=data.temperature,
        latitude=data.latitude if data.latitude is not None else None,
        longitude=data.longitude if data.longitude is not None else None
    )
    db.add(reading)
    
    # Run Risk Engine
    decision = RiskEngine.evaluate(data)
    
    # Update SystemStatus
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle.id).first()
    if not status:
        status = SystemStatus(vehicle_id=vehicle.id)
        db.add(status)
        
    previous_status = status.current_status
    
    status.current_risk_score = decision["risk_score"]
    status.current_status = decision["status"]
    status.engine_state = "ON" if decision["engine_state"] == 1 else "OFF"
    status.buzzer_state = str(decision["buzzer_action"]) + " sec" if decision["buzzer_action"] > 0 else "OFF"
    status.gps_connected = (data.latitude is not None and data.longitude is not None)
    
    # Create Risk Event only if transition or meaningfully elevated
    # For prototype: Create event if status changes, OR if we transitioned to/stay in CRITICAL but previous wasn't CRITICAL?
    # Actually, create if current_status != previous_status, or if it's the very first reading
    new_event = None
    if previous_status != decision["status"]:
        event = RiskEvent(
            vehicle_id=vehicle.id,
            risk_score=decision["risk_score"],
            status=decision["status"],
            reason=decision["reason"],
            alcohol_status="DETECTED" if decision["alcohol_detected"] else "NORMAL",
            rash_driving_status="DETECTED" if decision["rash_driving_detected"] else "NORMAL",
            buzzer_action=str(decision["buzzer_action"]),
            engine_state="ON" if decision["engine_state"] == 1 else "OFF",
            latitude=data.latitude,
            longitude=data.longitude
        )
        db.add(event)
        new_event = event

    db.commit()
    db.refresh(reading)
    if new_event:
        db.refresh(new_event)
        
    # Broadcast current status to WebSocket
    ws_status_payload = {
        "type": "vehicle_status",
        "vehicle_id": vehicle.id,
        "risk_score": decision["risk_score"],
        "status": decision["status"].value,
        "alcohol_detected": decision["alcohol_detected"],
        "rash_driving_detected": decision["rash_driving_detected"],
        "engine_state": decision["engine_state"],
        "buzzer_action": decision["buzzer_action"],
        "gps_connected": status.gps_connected,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "alcohol_value": data.alcohol_value,
        "accel_x": data.accel_x, "accel_y": data.accel_y, "accel_z": data.accel_z,
        "gyro_x": data.gyro_x, "gyro_y": data.gyro_y, "gyro_z": data.gyro_z,
        "temperature": data.temperature,
        "timestamp": reading.created_at.isoformat()
    }
    background_tasks.add_task(manager.broadcast, ws_status_payload, str(vehicle.id))

    if new_event:
        ws_event_payload = {
            "type": "safety_event",
            "id": new_event.id,
            "vehicle_id": new_event.vehicle_id,
            "status": new_event.status.value,
            "risk_score": new_event.risk_score,
            "reason": new_event.reason,
            "alcohol_status": new_event.alcohol_status,
            "rash_driving_status": new_event.rash_driving_status,
            "engine_state": new_event.engine_state,
            "buzzer_action": new_event.buzzer_action,
            "latitude": new_event.latitude,
            "longitude": new_event.longitude,
            "timestamp": new_event.created_at.isoformat()
        }
        background_tasks.add_task(manager.broadcast, ws_event_payload, str(vehicle.id))

    return SensorDataResponse(
        success=True, 
        reading_id=reading.id,
        status=decision["status"].value,
        risk_score=decision["risk_score"],
        alcohol_detected=decision["alcohol_detected"],
        rash_driving_detected=decision["rash_driving_detected"],
        engine_state=decision["engine_state"],
        buzzer_action=decision["buzzer_action"]
    )

@router.post("/vehicles/{vehicle_id}/reset", response_model=ResetResponse)
def reset_vehicle(vehicle_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
    db.refresh(status)
    
    # Broadcast reset state
    ws_status_payload = {
        "type": "vehicle_status",
        "vehicle_id": vehicle.id,
        "risk_score": status.current_risk_score,
        "status": status.current_status.value,
        "alcohol_detected": False,
        "rash_driving_detected": False,
        "engine_state": 1,
        "buzzer_action": 0,
        "gps_connected": status.gps_connected,
        "latitude": None,
        "longitude": None,
        "timestamp": status.updated_at.isoformat()
    }
    background_tasks.add_task(manager.broadcast, ws_status_payload, str(vehicle.id))
    
    return ResetResponse(success=True, message="Vehicle status reset successfully", vehicle_id=vehicle_id)
