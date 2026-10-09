from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import time
from database.deps import get_db
from database.models import Vehicle, SystemStatus, RiskEvent, SensorReading, SafetyStatus
from schemas.schemas import (
    SensorDataCreate, SensorDataResponse, VehicleResponse, 
    SystemStatusResponse, RiskEventResponse, SensorReadingResponse, ResetResponse, AdminCutoffResponse,
    LocationSyncRequest
)
from engine.risk_engine import RiskEngine
from api.websocket import manager

# Indian Standard Time (IST) UTC+05:30
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    return datetime.now(IST)

def get_ist_time_str() -> str:
    return datetime.now(IST).strftime("%I:%M:%S %p")

def get_ist_date_str() -> str:
    return datetime.now(IST).strftime("%d-%m-%Y")

router = APIRouter()

# In-memory tracking of real-time vehicle telemetry and admin cutoff state
VEHICLE_STATE = {
    1: {
        "speed": 0.0,
        "distance": 0.0,
        "latitude": None,
        "longitude": None,
        "critical_active": False,
        "critical_latched": False,
        "critical_reason": None,
        "critical_start": 0.0,
        "critical_timer": 0,
        "admin_cutoff": False,
        "admin_cutoff_start": 0.0,
        "admin_timer": 0,
    }
}

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
    return {"status": "ok", "service": "SafeRide API", "server_time_ist": get_ist_time_str()}

@router.get("/time")
def get_current_time():
    now_ist = get_ist_now()
    return {
        "timestamp_ist": now_ist.isoformat(),
        "time_ist": now_ist.strftime("%I:%M:%S %p"),
        "date_ist": now_ist.strftime("%d-%m-%Y"),
        "epoch": int(now_ist.timestamp()),
        "timezone": "IST (UTC+05:30)"
    }

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
    
    v_state = VEHICLE_STATE.setdefault(vehicle_id, {})
    # Check if admin cutoff is running
    admin_active = False
    admin_rem = 0
    if v_state.get("admin_cutoff", False):
        elapsed = time.time() - v_state.get("admin_cutoff_start", time.time())
        admin_rem = max(0, int(60 - elapsed))
        admin_active = True
        v_state["admin_timer"] = admin_rem

    # Check Critical Condition 1-minute countdown timer
    crit_active = v_state.get("critical_active", False)
    crit_rem = v_state.get("critical_timer", 0)
    if crit_active and v_state.get("critical_start", 0.0) > 0:
        elapsed_crit = time.time() - v_state["critical_start"]
        crit_rem = max(0, int(60 - elapsed_crit))
        v_state["critical_timer"] = crit_rem
        if crit_rem == 0:
            # 1-minute timer has expired! Lock into latched critical with engine OFF
            v_state["critical_active"] = False
            v_state["critical_latched"] = True

    is_latched = v_state.get("critical_latched", False) or admin_active

    # Determine Engine State:
    # 1. If admin cutoff: OFF immediately
    # 2. If latched critical (1-min timer expired): OFF
    # 3. If critical condition currently in 1-min countdown (crit_rem > 0): ON (warning phase before cutoff!)
    # 4. Otherwise: status.engine_state
    if admin_active or is_latched:
        effective_engine = "OFF"
    elif crit_active and crit_rem > 0:
        effective_engine = "ON"
    else:
        effective_engine = status.engine_state

    effective_status = SafetyStatus.CRITICAL if (is_latched or crit_active) else status.current_status
    effective_risk = 100 if is_latched else (85 if crit_active else status.current_risk_score)

    # Location resolution: At the start, show last active location from DB until new live coordinates arrive
    cur_lat = v_state.get("latitude")
    cur_lon = v_state.get("longitude")
    is_live = v_state.get("is_live_gps", False)
    if cur_lat is None or cur_lon is None or cur_lat == 0:
        last_reading = db.query(SensorReading).filter(
            SensorReading.vehicle_id == vehicle_id,
            SensorReading.latitude.isnot(None),
            SensorReading.latitude != 0.0
        ).order_by(SensorReading.created_at.desc()).first()
        if last_reading:
            cur_lat = float(last_reading.latitude)
            cur_lon = float(last_reading.longitude)
            v_state["latitude"] = cur_lat
            v_state["longitude"] = cur_lon
            v_state["last_known_lat"] = cur_lat
            v_state["last_known_lon"] = cur_lon
            is_live = False

    is_last_known = not is_live

    status_dict = {
        "vehicle_id": status.vehicle_id,
        "current_risk_score": effective_risk,
        "current_status": effective_status,
        "engine_state": effective_engine,
        "relay_state": effective_engine,
        "buzzer_state": "OFF" if admin_active else status.buzzer_state,
        "gps_connected": is_live,
        "is_last_known_location": is_last_known,
        "speed": v_state.get("speed", 0.0),
        "distance": v_state.get("distance", 0.0),
        "latitude": cur_lat,
        "longitude": cur_lon,
        "critical_active": is_latched or crit_active,
        "critical_latched": is_latched,
        "critical_timer": admin_rem if admin_active else crit_rem,
        "admin_cutoff": admin_active,
        "admin_timer": admin_rem,
        "server_time_ist": get_ist_time_str(),
        "timestamp_ist": get_ist_now().isoformat(),
        "last_seen": status.last_seen,
        "updated_at": status.updated_at
    }
    return SystemStatusResponse(**status_dict)

@router.get("/vehicles/{vehicle_id}/events", response_model=list[RiskEventResponse])
def get_vehicle_events(vehicle_id: int, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
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

@router.get("/vehicles/{vehicle_id}/risk-trend")
def get_vehicle_risk_trend(vehicle_id: int, limit: int = 30, db: Session = Depends(get_db)):
    readings = db.query(SensorReading).filter(SensorReading.vehicle_id == vehicle_id)\
                 .order_by(SensorReading.created_at.desc())\
                 .limit(limit).all()
    readings = list(reversed(readings))
    
    v_state = VEHICLE_STATE.get(vehicle_id, {})
    admin_active = False
    if v_state.get("admin_cutoff", False):
        elapsed = time.time() - v_state.get("admin_cutoff_start", time.time())
        if elapsed < 60:
            admin_active = True
    is_latched = v_state.get("critical_latched", False) or admin_active

    trend = []
    for r in readings:
        sensor_obj = SensorDataCreate(
            device_id="SR-001",
            alcohol_value=float(r.alcohol_value or 0),
            accel_x=float(r.accel_x or 0),
            accel_y=float(r.accel_y or 0),
            accel_z=float(r.accel_z or 9.8),
            gyro_x=float(r.gyro_x or 0),
            gyro_y=float(r.gyro_y or 0),
            gyro_z=float(r.gyro_z or 0),
            temperature=float(r.temperature or 0) if r.temperature else None,
            latitude=float(r.latitude) if r.latitude else None,
            longitude=float(r.longitude) if r.longitude else None,
            speed=0.0
        )
        decision = RiskEngine.evaluate(sensor_obj)
        score = decision["risk_score"]
        status_val = decision["status"].value
        
        trend.append({
            "id": r.id,
            "timestamp": r.created_at.isoformat(),
            "risk_score": score,
            "status": status_val,
            "alcohol_value": float(r.alcohol_value or 0),
            "accel_x": float(r.accel_x or 0),
            "accel_y": float(r.accel_y or 0),
            "accel_z": float(r.accel_z or 9.8),
            "gyro_x": float(r.gyro_x or 0),
            "gyro_y": float(r.gyro_y or 0),
            "gyro_z": float(r.gyro_z or 0),
            "temperature": float(r.temperature) if r.temperature else 0.0
        })

    if (admin_active or is_latched) and trend:
        trend[-1]["risk_score"] = 100
        trend[-1]["status"] = "CRITICAL"

    return trend

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
    
    # Update local vehicle state with live telemetry
    v_state = VEHICLE_STATE.setdefault(vehicle.id, {})
    if data.latitude is not None and data.longitude is not None and data.latitude != 0:
        v_state["latitude"] = data.latitude
        v_state["longitude"] = data.longitude
        v_state["last_known_lat"] = data.latitude
        v_state["last_known_lon"] = data.longitude
        v_state["is_live_gps"] = True
    else:
        # No live GPS yet: retain or load last active location from DB
        v_state["is_live_gps"] = False
        if v_state.get("latitude") is None:
            last_reading = db.query(SensorReading).filter(
                SensorReading.vehicle_id == vehicle.id,
                SensorReading.latitude.isnot(None),
                SensorReading.latitude != 0.0
            ).order_by(SensorReading.created_at.desc()).first()
            if last_reading:
                v_state["latitude"] = float(last_reading.latitude)
                v_state["longitude"] = float(last_reading.longitude)
                v_state["last_known_lat"] = float(last_reading.latitude)
                v_state["last_known_lon"] = float(last_reading.longitude)
        v_state["speed"] = data.speed
    if data.distance is not None:
        v_state["distance"] = data.distance
    if data.critical_latched:
        v_state["critical_latched"] = True
    if data.critical_active and not v_state.get("critical_active", False):
        v_state["critical_active"] = True
        v_state["critical_start"] = time.time()

    # Check Admin Cutoff status
    admin_cutoff_active = False
    admin_remaining = 0
    if v_state.get("admin_cutoff", False):
        elapsed = time.time() - v_state.get("admin_cutoff_start", time.time())
        admin_remaining = max(0, int(60 - elapsed))
        v_state["admin_timer"] = admin_remaining
        admin_cutoff_active = True

    # Run Risk Engine
    decision = RiskEngine.evaluate(data)
    
    # If Admin Cutoff is active, STRICTLY suppress alcohol / MPU warnings
    # Per user request: "shows offed by the admin and 1 minute timer starts but dont show alchol dectected or mpu"
    if admin_cutoff_active:
        decision["status"] = SafetyStatus.CRITICAL
        decision["risk_score"] = 100
        decision["reason"] = "OFFED BY ADMIN"
        decision["alcohol_detected"] = False
        decision["rash_driving_detected"] = False
        decision["engine_state"] = 0
        decision["buzzer_action"] = 0
        v_state["critical_active"] = True
        v_state["critical_latched"] = True
        v_state["critical_reason"] = "OFFED BY ADMIN"
        v_state["critical_timer"] = admin_remaining
    elif v_state.get("critical_latched", False) or data.critical_latched:
        # 1-minute timer has ALREADY expired, engine is locked OFF until manual reset!
        decision["status"] = SafetyStatus.CRITICAL
        decision["risk_score"] = max(decision["risk_score"], 100)
        decision["engine_state"] = 0
        decision["reason"] = v_state.get("critical_reason", "CRITICAL ENGINE SHUTDOWN (LATCHED)")
        v_state["critical_active"] = False
        v_state["critical_latched"] = True
        v_state["critical_timer"] = 0
    elif decision["status"] == SafetyStatus.CRITICAL or data.critical_active or v_state.get("critical_active", False):
        # Critical condition triggered or countdown in progress: Run 1-minute countdown timer!
        if not v_state.get("critical_active", False) or v_state.get("critical_start", 0.0) == 0.0:
            v_state["critical_start"] = time.time()
            v_state["critical_active"] = True
            v_state["critical_reason"] = decision.get("reason") or "CRITICAL SAFETY WARNING"
            v_state["critical_timer"] = 60

        elapsed = time.time() - v_state.get("critical_start", time.time())
        if data.critical_timer is not None and data.critical_timer > 0 and not v_state.get("critical_active", False):
            remaining = data.critical_timer
        else:
            remaining = max(0, int(60 - elapsed))

        v_state["critical_timer"] = remaining

        if remaining > 0:
            # During 1-minute timer: Engine remains ON so driver can pull over safely!
            decision["status"] = SafetyStatus.CRITICAL
            decision["risk_score"] = max(decision["risk_score"], 85)
            decision["engine_state"] = 1  # ENGINE ON during countdown
            decision["reason"] = v_state.get("critical_reason") or decision.get("reason") or "CRITICAL SAFETY WARNING"
            v_state["critical_latched"] = False
        else:
            # 1-minute timer expired! Engine cuts OFF now!
            decision["status"] = SafetyStatus.CRITICAL
            decision["risk_score"] = 100
            decision["engine_state"] = 0  # ENGINE CUT OFF!
            decision["reason"] = "CRITICAL ENGINE SHUTDOWN (1-MIN TIMER EXPIRED)"
            v_state["critical_active"] = False
            v_state["critical_latched"] = True
            v_state["critical_timer"] = 0
    elif data.engine_state is not None:
        # Reflect exact hardware engine light and relay state in safe/warning operation
        decision["engine_state"] = data.engine_state

    # Ensure decision reason is never null
    if not decision.get("reason"):
        decision["reason"] = "SAFETY MONITORING"

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
    
    # Create Risk Event if status changes or admin cutoff event
    new_event = None
    if previous_status != decision["status"]:
        event = RiskEvent(
            vehicle_id=vehicle.id,
            risk_score=decision["risk_score"],
            status=decision["status"],
            reason=decision.get("reason") or "SAFETY EVENT",
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
        
    effective_lat = data.latitude if (data.latitude is not None and data.latitude != 0) else v_state.get("latitude")
    effective_lon = data.longitude if (data.longitude is not None and data.longitude != 0) else v_state.get("longitude")
    status.gps_connected = (effective_lat is not None and effective_lon is not None)

    is_critical_latched = v_state.get("critical_latched", False) or admin_cutoff_active

    # Broadcast current status to WebSocket with IST timestamps and last location flag
    is_live = v_state.get("is_live_gps", False)
    ws_status_payload = {
        "type": "vehicle_status",
        "vehicle_id": vehicle.id,
        "risk_score": decision["risk_score"],
        "status": decision["status"].value,
        "reason": decision["reason"],
        "alcohol_detected": decision["alcohol_detected"],
        "rash_driving_detected": decision["rash_driving_detected"],
        "jerk_percentage": decision.get("jerk_percentage", 0),
        "jerk_beeps": decision.get("jerk_beeps", 0),
        "engine_state": decision["engine_state"],
        "relay_state": "ON" if decision["engine_state"] == 1 else "OFF",
        "buzzer_action": decision["buzzer_action"],
        "gps_connected": is_live,
        "is_last_known_location": not is_live,
        "latitude": effective_lat,
        "longitude": effective_lon,
        "speed": v_state.get("speed", 0.0),
        "distance": v_state.get("distance", 0.0),
        "critical_active": v_state.get("critical_active", False) or is_critical_latched,
        "critical_latched": is_critical_latched,
        "critical_timer": admin_remaining if admin_cutoff_active else v_state.get("critical_timer", 0),
        "admin_cutoff": admin_cutoff_active,
        "admin_timer": admin_remaining,
        "server_time_ist": get_ist_time_str(),
        "timestamp_ist": get_ist_now().isoformat(),
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
            "timestamp": new_event.created_at.isoformat(),
            "timestamp_ist": get_ist_now().isoformat()
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
        relay_state=1 if decision["engine_state"] == 1 else 0,
        buzzer_action=decision["buzzer_action"],
        reason=decision["reason"],
        jerk_percentage=decision.get("jerk_percentage", 0),
        jerk_beeps=decision.get("jerk_beeps", 0),
        speed=v_state.get("speed", 0.0),
        distance=v_state.get("distance", 0.0),
        critical_active=v_state.get("critical_active", False) or is_critical_latched,
        critical_latched=is_critical_latched,
        critical_timer=admin_remaining if admin_cutoff_active else v_state.get("critical_timer", 0),
        admin_cutoff=admin_cutoff_active,
        admin_timer=admin_remaining,
        last_latitude=v_state.get("last_known_lat") or v_state.get("latitude"),
        last_longitude=v_state.get("last_known_lon") or v_state.get("longitude"),
        is_last_known_location=not is_live,
        server_time_ist=get_ist_time_str(),
        server_epoch=int(get_ist_now().timestamp())
    )

@router.post("/vehicles/{vehicle_id}/sync-location")
def sync_vehicle_location(vehicle_id: int, loc: LocationSyncRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    v_state = VEHICLE_STATE.setdefault(vehicle_id, {})
    v_state["latitude"] = loc.latitude
    v_state["longitude"] = loc.longitude
    
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle_id).first()
    if status:
        status.gps_connected = True
        db.commit()
        
    ws_update = {
        "type": "location_update",
        "vehicle_id": vehicle_id,
        "latitude": loc.latitude,
        "longitude": loc.longitude,
        "gps_connected": True
    }
    background_tasks.add_task(manager.broadcast, ws_update, str(vehicle_id))
    return {"status": "ok", "latitude": loc.latitude, "longitude": loc.longitude}

@router.post("/vehicles/{vehicle_id}/admin-cutoff", response_model=AdminCutoffResponse)
def trigger_admin_cutoff(vehicle_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle_id).first()
    if not status:
        status = SystemStatus(vehicle_id=vehicle_id)
        db.add(status)

    status.current_risk_score = 100
    status.current_status = SafetyStatus.CRITICAL
    status.engine_state = "OFF"
    status.buzzer_state = "OFF"
    
    # Configure Admin Cutoff in state
    v_state = VEHICLE_STATE.setdefault(vehicle_id, {})
    v_state["admin_cutoff"] = True
    v_state["admin_cutoff_start"] = time.time()
    v_state["admin_timer"] = 60
    v_state["critical_active"] = True
    v_state["critical_latched"] = True
    v_state["critical_reason"] = "OFFED BY ADMIN"
    v_state["critical_timer"] = 60

    # Record Admin Cutoff Event
    event = RiskEvent(
        vehicle_id=vehicle.id,
        risk_score=100,
        status=SafetyStatus.CRITICAL,
        reason="OFFED BY ADMIN",
        alcohol_status="NORMAL",
        rash_driving_status="NORMAL",
        buzzer_action="0",
        engine_state="OFF",
        latitude=v_state.get("latitude"),
        longitude=v_state.get("longitude")
    )
    db.add(event)
    db.commit()
    db.refresh(status)
    db.refresh(event)

    # Broadcast to WebSocket immediately
    ws_status_payload = {
        "type": "vehicle_status",
        "vehicle_id": vehicle.id,
        "risk_score": 100,
        "status": "CRITICAL",
        "reason": "OFFED BY ADMIN",
        "alcohol_detected": False,
        "rash_driving_detected": False,
        "jerk_percentage": 0,
        "jerk_beeps": 0,
        "engine_state": 0,
        "buzzer_action": 0,
        "gps_connected": status.gps_connected or (v_state.get("latitude") is not None),
        "latitude": v_state.get("latitude"),
        "longitude": v_state.get("longitude"),
        "speed": v_state.get("speed", 0.0),
        "distance": v_state.get("distance", 0.0),
        "critical_active": True,
        "critical_latched": True,
        "critical_timer": 60,
        "admin_cutoff": True,
        "admin_timer": 60,
        "timestamp": status.updated_at.isoformat()
    }
    background_tasks.add_task(manager.broadcast, ws_status_payload, str(vehicle.id))

    ws_event_payload = {
        "type": "safety_event",
        "id": event.id,
        "vehicle_id": event.vehicle_id,
        "status": event.status.value,
        "risk_score": event.risk_score,
        "reason": event.reason,
        "alcohol_status": event.alcohol_status,
        "rash_driving_status": event.rash_driving_status,
        "engine_state": event.engine_state,
        "buzzer_action": event.buzzer_action,
        "latitude": v_state.get("latitude"),
        "longitude": v_state.get("longitude"),
        "timestamp": event.created_at.isoformat()
    }
    background_tasks.add_task(manager.broadcast, ws_event_payload, str(vehicle.id))

    return AdminCutoffResponse(
        success=True,
        message="Engine shut off by admin. 1-minute shutdown active.",
        vehicle_id=vehicle_id,
        admin_cutoff=True,
        admin_timer=60
    )

@router.post("/vehicles/{vehicle_id}/reset", response_model=ResetResponse)
def reset_vehicle(vehicle_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    status = db.query(SystemStatus).filter(SystemStatus.vehicle_id == vehicle_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="System status not found for vehicle")

    # Clear Admin Cutoff and un-latch critical safety lockout
    v_state = VEHICLE_STATE.setdefault(vehicle_id, {})
    v_state["admin_cutoff"] = False
    v_state["admin_cutoff_start"] = 0.0
    v_state["admin_timer"] = 0
    v_state["critical_active"] = False
    v_state["critical_latched"] = False
    v_state["critical_start"] = 0.0
    v_state["critical_reason"] = None
    v_state["critical_timer"] = 0

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
        "reason": "SYSTEM RESET - ENGINE RESTORED",
        "alcohol_detected": False,
        "rash_driving_detected": False,
        "jerk_percentage": 0,
        "jerk_beeps": 0,
        "engine_state": 1,
        "buzzer_action": 0,
        "gps_connected": status.gps_connected or (v_state.get("latitude") is not None),
        "latitude": v_state.get("latitude"),
        "longitude": v_state.get("longitude"),
        "speed": v_state.get("speed", 0.0),
        "distance": v_state.get("distance", 0.0),
        "critical_active": False,
        "critical_latched": False,
        "critical_timer": 0,
        "admin_cutoff": False,
        "admin_timer": 0,
        "timestamp": status.updated_at.isoformat()
    }
    background_tasks.add_task(manager.broadcast, ws_status_payload, str(vehicle.id))
    
    return ResetResponse(success=True, message="Vehicle status reset successfully", vehicle_id=vehicle_id)

