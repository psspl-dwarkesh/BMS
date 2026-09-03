"""
Seed script to initialize the database with schema, admin user, standard user,
devices, and a historical telemetry trace for Device 1.

Safe to re-run by default: if the `users` table already has rows, seeding is
skipped entirely rather than wiping the database (this used to always
`drop_all()` first unconditionally, which is fine against an empty local
SQLite file but would destroy real data if ever re-run against a populated
production database, e.g. Neon after go-live). Pass --reset to explicitly
opt into the old destructive drop-and-recreate behavior.
"""
import argparse
import os
import io
import datetime
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from config import settings
from database import engine, Base, SessionLocal
from models import (
    User, UserRole, Device, DeviceAssignment, ConnectionType, Chemistry
)
from routers import hash_password
from ingestion import ingest_telemetry_row
from models import TelemetrySource


def seed_database(reset: bool = False):
    if reset:
        print("--reset passed: dropping all tables first...")
        Base.metadata.drop_all(bind=engine)
    else:
        # Idempotency guard: only skip if the `users` table exists AND has
        # rows. inspect() lets us check "does the table exist yet" first, so
        # a genuinely fresh database (schema not created at all) still seeds
        # normally instead of throwing on a missing table.
        if inspect(engine).has_table("users"):
            db_check: Session = SessionLocal()
            try:
                if db_check.query(User).first() is not None:
                    print("Database already has users — skipping seed (safe to re-run). "
                          "Pass --reset to wipe and reseed from scratch.")
                    return
            finally:
                db_check.close()

    print("Creating schema...")
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # ── 1. Create Users ───────────────────────────────────────────────────
        print("Creating users...")
        admin = User(
            email="admin@bms.local",
            hashed_password=hash_password("admin123"),
            full_name="Admin User",
            role=UserRole.admin,
        )
        db.add(admin)
        
        user1 = User(
            email="user@bms.local",
            hashed_password=hash_password("user123"),
            full_name="Standard User",
            role=UserRole.user,
        )
        db.add(user1)
        db.commit()
        db.refresh(admin)
        db.refresh(user1)

        # ── 2. Create Devices ─────────────────────────────────────────────────
        print("Creating devices...")
        dev1 = Device(
            serial_number="BMS-1001",
            pack_name="Forklift Alpha",
            manufacturer="Acme Batteries",
            chemistry=Chemistry.li_ion,
            rated_voltage=48.0,
            rated_capacity_ah=100.0,
            connection_type=ConnectionType.SIMULATED,
            install_site="Warehouse A",
            home_latitude=37.7749,
            home_longitude=-122.4194,
        )
        db.add(dev1)
        
        dev2 = Device(
            serial_number="BMS-1002",
            pack_name="Backup Gen 1",
            manufacturer="Acme Batteries",
            chemistry=Chemistry.lifepo4,
            rated_voltage=48.0,
            rated_capacity_ah=200.0,
            connection_type=ConnectionType.SIMULATED,
            install_site="Datacenter B",
            home_latitude=34.0522,
            home_longitude=-118.2437,
        )
        db.add(dev2)
        
        dev3 = Device(
            serial_number="BMS-1003",
            pack_name="EV Prototype",
            manufacturer="Beta Motors",
            chemistry=Chemistry.li_ion,
            rated_voltage=400.0,
            rated_capacity_ah=75.0,
            connection_type=ConnectionType.SIMULATED,
            install_site="Test Track",
            home_latitude=40.7128,
            home_longitude=-74.0060,
        )
        db.add(dev3)
        db.commit()
        db.refresh(dev1)
        db.refresh(dev2)
        db.refresh(dev3)

        # ── 3. Device Assignments ─────────────────────────────────────────────
        print("Assigning devices...")
        # Give User1 access to dev1 and dev2 (but not dev3)
        db.add(DeviceAssignment(device_id=dev1.id, user_id=user1.id, assigned_by_user_id=admin.id))
        db.add(DeviceAssignment(device_id=dev2.id, user_id=user1.id, assigned_by_user_id=admin.id))
        db.commit()

        # ── 4. Seed Telemetry History ─────────────────────────────────────────
        csv_path = os.path.join(os.path.dirname(__file__), "sample_history.csv")
        if os.path.exists(csv_path):
            print("Importing sample_history.csv for Device 1...")
            df = pd.read_csv(csv_path)
            
            cols = df.columns
            time_col = next((c for c in cols if 'time' in c.lower() or 'date' in c.lower()), None)
            v_col = next((c for c in cols if 'pack' in c.lower() and 'volt' in c.lower() or ('volt' in c.lower() and 'cell' not in c.lower())), None)
            c_col = next((c for c in cols if 'pack' in c.lower() and 'curr' in c.lower() or ('curr' in c.lower() and 'cell' not in c.lower())), None)
            soc_col = next((c for c in cols if 'soc' in c.lower()), None)
            soh_col = next((c for c in cols if 'soh' in c.lower()), None)
            lat_col = next((c for c in cols if 'lat' in c.lower()), None)
            lng_col = next((c for c in cols if 'lon' in c.lower()), None)
            
            cell_v_cols = [c for c in cols if 'cell' in c.lower() and 'volt' in c.lower()]
            cell_t_cols = [c for c in cols if 'therm' in c.lower() or ('cell' in c.lower() and 'temp' in c.lower())]
            
            count = 0
            for idx, row in df.iterrows():
                sample_time = pd.to_datetime(row[time_col]).to_pydatetime() if time_col else datetime.datetime.utcnow()
                
                fields = {
                    "pack_voltage": float(row[v_col]) if v_col and pd.notnull(row[v_col]) else None,
                    "pack_current": float(row[c_col]) if c_col and pd.notnull(row[c_col]) else None,
                    "soc": float(row[soc_col]) if soc_col and pd.notnull(row[soc_col]) else None,
                    "soh": float(row[soh_col]) if soh_col and pd.notnull(row[soh_col]) else None,
                    "latitude": float(row[lat_col]) if lat_col and pd.notnull(row[lat_col]) else None,
                    "longitude": float(row[lng_col]) if lng_col and pd.notnull(row[lng_col]) else None,
                }
                
                cell_readings_data = []
                max_cells = max(len(cell_v_cols), len(cell_t_cols))
                
                for i in range(max_cells):
                    v = None
                    if i < len(cell_v_cols) and pd.notnull(row[cell_v_cols[i]]):
                        v = float(row[cell_v_cols[i]])
                        if v < 100: v *= 1000  # convert V to mV
                    
                    t = None
                    if i < len(cell_t_cols) and pd.notnull(row[cell_t_cols[i]]):
                        t = float(row[cell_t_cols[i]])
                        
                    if v is not None or t is not None:
                        cell_readings_data.append({
                            "cell_number": i + 1,
                            "voltage_mv": v,
                            "temperature_c": t
                        })
                
                if cell_readings_data:
                    v_vals = [cr["voltage_mv"] for cr in cell_readings_data if cr["voltage_mv"] is not None]
                    t_vals = [cr["temperature_c"] for cr in cell_readings_data if cr["temperature_c"] is not None]
                    
                    if v_vals:
                        fields["max_cell_voltage"] = max(v_vals) / 1000.0
                        fields["min_cell_voltage"] = min(v_vals) / 1000.0
                        fields["avg_cell_voltage"] = (sum(v_vals) / len(v_vals)) / 1000.0
                        
                    if t_vals:
                        fields["max_thermistor_temp"] = max(t_vals)
                        fields["min_thermistor_temp"] = min(t_vals)
                        fields["avg_cell_temp"] = sum(t_vals) / len(t_vals)
                
                ingest_telemetry_row(
                    db, dev1, sample_time, fields, cell_readings_data, TelemetrySource.csv_import
                )
                count += 1
            
            db.commit()
            print(f"Imported {count} historical records.")
        else:
            print("No sample_history.csv found to seed.")
            
        print("Database seeded successfully.")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Drop all tables and reseed from scratch (destructive).")
    args = parser.parse_args()
    seed_database(reset=args.reset)
