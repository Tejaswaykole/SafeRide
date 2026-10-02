from datetime import datetime
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .config import Base
import enum

class SafetyStatus(enum.Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    vehicle_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sensor_readings = relationship("SensorReading", back_populates="vehicle", cascade="all, delete-orphan")
    risk_events = relationship("RiskEvent", back_populates="vehicle", cascade="all, delete-orphan")
    system_status = relationship("SystemStatus", back_populates="vehicle", uselist=False, cascade="all, delete-orphan")

class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    alcohol_value: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    accel_x: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    accel_y: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    accel_z: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    gyro_x: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    gyro_y: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    gyro_z: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    temperature: Mapped[float] = mapped_column(Numeric(10, 4), nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="sensor_readings")

class RiskEvent(Base):
    __tablename__ = "risk_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    risk_score: Mapped[int] = mapped_column(Integer)
    status: Mapped[SafetyStatus] = mapped_column(Enum(SafetyStatus))
    reason: Mapped[str] = mapped_column(String(255))
    alcohol_status: Mapped[str] = mapped_column(String(50), nullable=True)
    rash_driving_status: Mapped[str] = mapped_column(String(50), nullable=True)
    buzzer_action: Mapped[str] = mapped_column(String(50), nullable=True)
    engine_state: Mapped[str] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="risk_events")

class SystemStatus(Base):
    __tablename__ = "system_status"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), unique=True)
    current_risk_score: Mapped[int] = mapped_column(Integer, default=0)
    current_status: Mapped[SafetyStatus] = mapped_column(Enum(SafetyStatus), default=SafetyStatus.SAFE)
    engine_state: Mapped[str] = mapped_column(String(50), default="ON")
    buzzer_state: Mapped[str] = mapped_column(String(50), default="OFF")
    gps_connected: Mapped[bool] = mapped_column(default=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="system_status")
