from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class BatteryPack(Base):
    __tablename__ = "battery_packs"

    id = Column(Integer, primary_key=True, index=True)
    pack_name = Column(String, index=True)
    status = Column(String, default="Active")
    cell_count = Column(Integer, default=96)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
class PackTelemetry(Base):
    __tablename__ = "pack_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    pack_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    voltage = Column(Float)
    current = Column(Float)
    temperature = Column(Float)
    soc = Column(Float)
