"""Telemetry router — fetch latest snapshot, history, export CSV, and CSV import."""
import datetime
import io
import csv

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
import pandas as pd

from database import get_db
from models import CellReading, Device, Telemetry, TelemetrySource, User
from routers import get_current_user, get_scoped_device, require_admin
from ws_manager import manager

router = APIRouter(prefix="/api/v1/devices/{device_id}/telemetry", tags=["telemetry"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _telemetry_to_dict(t: Telemetry, include_cells: bool = False) -> dict:
    d = {
        "id"               : t.id,
        "sample_time"      : t.sample_time.isoformat(),
        "ingested_at"      : t.ingested_at.isoformat(),
        "source"           : t.source.value if t.source else None,
        "pack_voltage"     : t.pack_voltage,
        "pack_current"     : t.pack_current,
        "soc"              : t.soc,
        "soh"              : t.soh,
        "avg_cell_voltage" : t.avg_cell_voltage,
        "avg_cell_temp"    : t.avg_cell_temp,
        "internal_temp"    : t.internal_temp,
        "fet_temp"         : t.fet_temp,
        "max_cell_voltage" : t.max_cell_voltage,
        "max_cell_voltage_cell_num": t.max_cell_voltage_cell_num,
        "min_cell_voltage" : t.min_cell_voltage,
        "min_cell_voltage_cell_num": t.min_cell_voltage_cell_num,
        "max_thermistor_temp": t.max_thermistor_temp,
        "max_thermistor_num" : t.max_thermistor_num,
        "min_thermistor_temp": t.min_thermistor_temp,
        "min_thermistor_num" : t.min_thermistor_num,
        "latitude"         : t.latitude,
        "longitude"        : t.longitude,
    }
    if include_cells:
        d["cell_readings"] = [
            {
                "cell_number"  : cr.cell_number,
                "voltage_mv"   : cr.voltage_mv,
                "temperature_c": cr.temperature_c,
            }
            for cr in sorted(t.cell_readings, key=lambda x: x.cell_number)
        ]
    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/latest")
def get_latest_telemetry(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the single most recent snapshot with FULL per-cell breakdown."""
    device = get_scoped_device(device_id, current_user, db)
    t = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device.id)
        .options(joinedload(Telemetry.cell_readings))
        .order_by(Telemetry.sample_time.desc())
        .first()
    )
    if not t:
        return None
    return _telemetry_to_dict(t, include_cells=True)


@router.get("/history")
def get_telemetry_history(
    device_id: int,
    start: str | None = None,
    end: str | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated pack-level history (no cell readings to save bandwidth)."""
    device = get_scoped_device(device_id, current_user, db)

    q = db.query(Telemetry).filter(Telemetry.device_id == device.id)

    if start:
        q = q.filter(Telemetry.sample_time >= datetime.datetime.fromisoformat(start.replace('Z', '+00:00')))
    if end:
        q = q.filter(Telemetry.sample_time <= datetime.datetime.fromisoformat(end.replace('Z', '+00:00')))

    total = q.count()
    rows = (
        q.order_by(Telemetry.sample_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_telemetry_to_dict(r, include_cells=False) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{telemetry_id}/cells")
def get_historical_cells(
    device_id: int,
    telemetry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Drill-down to get per-cell readings for one specific historical row."""
    device = get_scoped_device(device_id, current_user, db)
    t = (
        db.query(Telemetry)
        .filter(Telemetry.id == telemetry_id, Telemetry.device_id == device.id)
        .options(joinedload(Telemetry.cell_readings))
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Telemetry snapshot not found")
    return _telemetry_to_dict(t, include_cells=True)


@router.get("/history/export")
def export_history_csv(
    device_id: int,
    start: str | None = None,
    end: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams a CSV export of the requested date range."""
    device = get_scoped_device(device_id, current_user, db)

    q = db.query(Telemetry).filter(Telemetry.device_id == device.id)
    if start:
        q = q.filter(Telemetry.sample_time >= datetime.datetime.fromisoformat(start.replace('Z', '+00:00')))
    if end:
        q = q.filter(Telemetry.sample_time <= datetime.datetime.fromisoformat(end.replace('Z', '+00:00')))
    q = q.order_by(Telemetry.sample_time.desc())

    # We use yield to stream the CSV row by row so we don't blow up memory on large ranges
    def iter_csv():
        # Using a small chunk size for db iteration
        # Note: Using .yield_per() is the SQLAlchemy way to stream results
        query_iter = q.yield_per(100)
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Timestamp", "Pack_Voltage", "Pack_Current", "SOC", "SOH", 
            "Avg_Cell_Temp", "Avg_Cell_Voltage", "Internal_Temp", "FET_Temp",
            "Latitude", "Longitude", "Source"
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for row in query_iter:
            writer.writerow([
                row.sample_time.isoformat(),
                row.pack_voltage,
                row.pack_current,
                row.soc,
                row.soh,
                row.avg_cell_temp,
                row.avg_cell_voltage,
                row.internal_temp,
                row.fet_temp,
                row.latitude,
                row.longitude,
                row.source.value if row.source else ""
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"device_{device.serial_number}_export.csv"
    response = StreamingResponse(iter_csv(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response


def _process_import_in_background(device_id: int, df_json: str):
    """
    Background task to bulk-import a CSV's rows as historical telemetry.

    Writes are batched (BATCH_SIZE rows per flush/commit), not one row at a
    time: the straightforward per-row approach (call the same
    ingest_telemetry_row() the live simulator uses, once per row, committing
    each time) made a several-hundred-row import take minutes against a
    remote DB like Neon - each commit, and each of ingest_telemetry_row's
    per-cell alert-threshold checks, is its own network round trip. A
    historical backfill doesn't need real-time alerting per row anyway (that
    row-by-row alert state machine is for live data), so this bypasses
    ingest_telemetry_row entirely and does its own batched inserts instead.
    """
    db: Session = next(get_db())
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return

        df = pd.read_json(io.StringIO(df_json), orient="records")

        # Try to find columns
        cols = df.columns
        time_col = next((c for c in cols if 'time' in c.lower() or 'date' in c.lower()), None)
        v_col = next((c for c in cols if 'pack' in c.lower() and 'volt' in c.lower() or ('volt' in c.lower() and 'cell' not in c.lower())), None)
        c_col = next((c for c in cols if 'pack' in c.lower() and 'curr' in c.lower() or ('curr' in c.lower() and 'cell' not in c.lower())), None)
        soc_col = next((c for c in cols if 'soc' in c.lower()), None)
        soh_col = next((c for c in cols if 'soh' in c.lower()), None)
        
        cell_v_cols = [c for c in cols if 'cell' in c.lower() and 'volt' in c.lower()]
        cell_t_cols = [c for c in cols if 'cell' in c.lower() and 'temp' in c.lower() or 'therm' in c.lower()]

        BATCH_SIZE = 200
        pending: list[tuple[Telemetry, list[dict]]] = []
        rows_written = 0

        def flush_batch():
            nonlocal rows_written
            if not pending:
                return
            db.add_all([t for t, _ in pending])
            db.flush()  # one batched round-trip; populates .id on every Telemetry object
            cell_rows = []
            for t, cells in pending:
                for cr in cells:
                    cell_rows.append(CellReading(
                        telemetry_id=t.id,
                        cell_number=cr["cell_number"],
                        voltage_mv=cr.get("voltage_mv"),
                        temperature_c=cr.get("temperature_c"),
                    ))
            if cell_rows:
                db.add_all(cell_rows)
                db.flush()
            db.commit()
            rows_written += len(pending)
            pending.clear()

        # Limit to 1000 rows for safety in this demo
        for idx, row in df.head(1000).iterrows():
            sample_time = datetime.datetime.utcnow()
            if time_col and pd.notnull(row[time_col]):
                try:
                    sample_time = pd.to_datetime(row[time_col]).to_pydatetime()
                except:
                    pass
                    
            fields = {
                "pack_voltage": float(row[v_col]) if v_col and pd.notnull(row[v_col]) else None,
                "pack_current": float(row[c_col]) if c_col and pd.notnull(row[c_col]) else None,
                "soc": float(row[soc_col]) if soc_col and pd.notnull(row[soc_col]) else None,
                "soh": float(row[soh_col]) if soh_col and pd.notnull(row[soh_col]) else None,
            }
            
            # Extract cell readings
            cell_readings_data = []
            max_cells = max(len(cell_v_cols), len(cell_t_cols))
            
            for i in range(max_cells):
                v = None
                if i < len(cell_v_cols) and pd.notnull(row[cell_v_cols[i]]):
                    v = float(row[cell_v_cols[i]])
                    if v < 100: v *= 1000 # Convert V to mV if needed
                
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
                # Calculate extremes
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
            
            trow = Telemetry(
                device_id=device.id,
                sample_time=sample_time,
                source=TelemetrySource.csv_import,
                **fields,
            )
            pending.append((trow, cell_readings_data))
            if len(pending) >= BATCH_SIZE:
                flush_batch()

        flush_batch()  # final partial batch
        device.last_seen_at = datetime.datetime.utcnow()
        db.commit()
        print(f"CSV import for device {device_id}: {rows_written} rows written.")

    except Exception as e:
        print(f"Error importing CSV: {e}")
        db.rollback()
    finally:
        db.close()


@router.post("/import")
async def import_csv_telemetry(
    device_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Import a CSV to add historical data to a device."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        df_json = df.to_json(orient="records")
        background_tasks.add_task(_process_import_in_background, device_id, df_json)
        
        return {
            "message": "CSV upload accepted, processing in background.",
            "rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
