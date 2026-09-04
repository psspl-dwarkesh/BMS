"""Telemetry router — fetch latest snapshot, history, export CSV, and CSV import."""
import datetime
import io
import csv
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
import pandas as pd

from database import get_db
from models import CellReading, Device, ImportStatus, Telemetry, TelemetryImport, TelemetrySource, User
from routers import get_current_user, get_scoped_device, require_admin, to_utc_iso
from ingestion import check_telemetry_thresholds
from ws_manager import manager

router = APIRouter(prefix="/api/v1/devices/{device_id}/telemetry", tags=["telemetry"])
log = logging.getLogger("bms.telemetry")

# Cap on rows streamed per history export (demo safety limit - see
# export_history_csv).
EXPORT_ROW_LIMIT = 100_000

# Cap on rows written per CSV import (demo safety limit, see
# _process_import_in_background) - keep the endpoint's reported row count in
# sync with what actually gets written.
IMPORT_ROW_LIMIT = 1000


# ── Helpers ───────────────────────────────────────────────────────────────────

def _telemetry_to_dict(t: Telemetry, include_cells: bool = False) -> dict:
    d = {
        "id"               : t.id,
        "sample_time"      : to_utc_iso(t.sample_time),
        "ingested_at"      : to_utc_iso(t.ingested_at),
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
        "cycle_number"     : t.cycle_number,
        "capacity_ah"      : t.capacity_ah,
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


def _visible_telemetry_query(db: Session, device_id: int):
    """
    Base Telemetry query for a device, excluding rows from any CSV import
    batch the user has toggled off ("Include" switch in the Upload History
    panel). Rows with no import_id (simulator/live device data) are never
    affected. Used by every endpoint that feeds an analytics view (latest,
    history, export, GPS trace in location.py) so one toggle in the panel
    propagates everywhere without each endpoint reimplementing the filter.
    """
    return (
        db.query(Telemetry)
        .outerjoin(TelemetryImport, Telemetry.import_id == TelemetryImport.id)
        .filter(Telemetry.device_id == device_id)
        .filter(or_(Telemetry.import_id.is_(None), TelemetryImport.included == True))
    )


def _import_to_dict(imp: TelemetryImport) -> dict:
    return {
        "id"            : imp.id,
        "device_id"     : imp.device_id,
        "filename"      : imp.filename,
        "uploaded_at"   : to_utc_iso(imp.uploaded_at),
        "uploaded_by_user_id": imp.uploaded_by_user_id,
        "row_count"     : imp.row_count,
        "rows_skipped"  : imp.rows_skipped,
        "status"        : imp.status.value if imp.status else None,
        "included"      : imp.included,
    }


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
        _visible_telemetry_query(db, device.id)
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

    q = _visible_telemetry_query(db, device.id)

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

    q = _visible_telemetry_query(db, device.id)
    if start:
        q = q.filter(Telemetry.sample_time >= datetime.datetime.fromisoformat(start.replace('Z', '+00:00')))
    if end:
        q = q.filter(Telemetry.sample_time <= datetime.datetime.fromisoformat(end.replace('Z', '+00:00')))
    # Unbounded before: omitting start/end (or passing a huge range) streamed
    # the device's entire telemetry history in one response. Streaming keeps
    # memory bounded but not DB/CPU time, so cap the row count too.
    q = q.order_by(Telemetry.sample_time.desc()).limit(EXPORT_ROW_LIMIT)

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


def _process_import_in_background(device_id: int, df_json: str, import_id: int):
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

    `import_id` tags every Telemetry row it writes with the TelemetryImport
    batch (created synchronously by the endpoint before this task was
    scheduled) so the Upload History panel's include/exclude toggle and
    delete both have something to act on.
    """
    db: Session = next(get_db())
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        import_batch = db.query(TelemetryImport).filter(TelemetryImport.id == import_id).first()
        if not device or not import_batch:
            return

        df = pd.read_json(io.StringIO(df_json), orient="records")

        # Try to find columns
        cols = df.columns
        time_col = next((c for c in cols if 'time' in c.lower() or 'date' in c.lower()), None)
        v_col = next((c for c in cols if 'pack' in c.lower() and 'volt' in c.lower() or ('volt' in c.lower() and 'cell' not in c.lower())), None)
        c_col = next((c for c in cols if 'pack' in c.lower() and 'curr' in c.lower() or ('curr' in c.lower() and 'cell' not in c.lower())), None)
        soc_col = next((c for c in cols if 'soc' in c.lower()), None)
        soh_col = next((c for c in cols if 'soh' in c.lower()), None)
        # Telemetry.latitude/longitude and location.py's GPS-trace endpoint
        # already existed, but nothing ever populated them from an imported
        # CSV - a file with Latitude/Longitude columns silently lost that
        # data. 'long' catches "Longitude" without also matching "Latitude".
        lat_col = next((c for c in cols if 'lat' in c.lower()), None)
        lng_col = next((c for c in cols if 'lng' in c.lower() or 'lon' in c.lower()), None)
        # Cycle_Number/Capacity_Ah (lab-cycling logs) - advertised in
        # DataIngestion.jsx's "Expected CSV Format" note but never actually
        # read here before Telemetry had columns for them.
        cycle_col = next((c for c in cols if 'cycle' in c.lower()), None)
        capacity_col = next((c for c in cols if 'capacity' in c.lower()), None)

        cell_v_cols = [c for c in cols if 'cell' in c.lower() and 'volt' in c.lower()]
        cell_t_cols = [c for c in cols if 'cell' in c.lower() and 'temp' in c.lower() or 'therm' in c.lower()]

        BATCH_SIZE = 200
        pending: list[tuple[Telemetry, list[dict]]] = []
        rows_written = 0
        rows_skipped = 0
        latest = None  # (Telemetry, fields, sample_time, cell_readings_data) for the most-recent row seen

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

        # Limit rows for safety in this demo
        for idx, row in df.head(IMPORT_ROW_LIMIT).iterrows():
            # Per-row try/except: a single malformed row (e.g. a non-numeric
            # value in a column we expect to be numeric) used to propagate
            # all the way up to the outer except below, which rolled back
            # only the *current* not-yet-committed batch - any earlier
            # batches were already flush_batch()-committed, so the import
            # silently ended up partial with no record of where it stopped.
            # Skipping just the bad row keeps the rest of a large, mostly-
            # good file intact instead of losing it to one outlier.
            try:
                sample_time = datetime.datetime.utcnow()
                if time_col and pd.notnull(row[time_col]):
                    try:
                        sample_time = pd.to_datetime(row[time_col]).to_pydatetime()
                    except Exception:
                        pass

                fields = {
                    "pack_voltage": float(row[v_col]) if v_col and pd.notnull(row[v_col]) else None,
                    "pack_current": float(row[c_col]) if c_col and pd.notnull(row[c_col]) else None,
                    "soc": float(row[soc_col]) if soc_col and pd.notnull(row[soc_col]) else None,
                    "soh": float(row[soh_col]) if soh_col and pd.notnull(row[soh_col]) else None,
                    "latitude": float(row[lat_col]) if lat_col and pd.notnull(row[lat_col]) else None,
                    "longitude": float(row[lng_col]) if lng_col and pd.notnull(row[lng_col]) else None,
                    "cycle_number": int(row[cycle_col]) if cycle_col and pd.notnull(row[cycle_col]) else None,
                    "capacity_ah": float(row[capacity_col]) if capacity_col and pd.notnull(row[capacity_col]) else None,
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
                    import_id=import_id,
                    **fields,
                )
                pending.append((trow, cell_readings_data))
                if latest is None or sample_time >= latest[2]:
                    latest = (trow, fields, sample_time, cell_readings_data)
                if len(pending) >= BATCH_SIZE:
                    flush_batch()
            except Exception:
                rows_skipped += 1
                log.warning("CSV import for device %s: skipped row %s (malformed data)", device_id, idx, exc_info=True)

        flush_batch()  # final partial batch
        device.last_seen_at = datetime.datetime.utcnow()

        # Real-time alerting doesn't apply to the historical rows (see
        # flush_batch above), but the device's *current* state - its most
        # recent row - should still surface real alerts, same as if this
        # were a live device: e.g. a battery imported at 12% SOC should show
        # up as a genuine low-SOC alert, not just a client-side chart
        # annotation. `latest` tracks the max-sample_time row seen (CSV rows
        # aren't guaranteed to already be in chronological order), and by
        # this point flush_batch() has given it a real trow.id.
        if latest is not None:
            latest_trow, latest_fields, _, latest_cells = latest
            check_telemetry_thresholds(db, device.id, latest_trow.id, latest_fields, latest_cells)

        import_batch.row_count = rows_written
        import_batch.rows_skipped = rows_skipped
        import_batch.status = ImportStatus.completed
        db.commit()
        if rows_skipped:
            log.warning("CSV import for device %s: %s rows written, %s rows skipped (malformed data).", device_id, rows_written, rows_skipped)
        else:
            log.info("CSV import for device %s: %s rows written.", device_id, rows_written)

    except Exception:
        # A fatal error here (as opposed to a per-row one, handled above) -
        # e.g. the device disappearing mid-import, or a DB error - still
        # rolls back whatever's pending, but is now a real log entry
        # (captured by whatever log aggregation the deployment has) instead
        # of a print() that most production setups never see.
        log.exception("CSV import for device %s failed and was rolled back.", device_id)
        db.rollback()
        # Mark the batch failed on its own small transaction - the rollback
        # above already discarded the failed telemetry writes, so this is
        # safe to commit independently and gives the Upload History panel a
        # real status instead of leaving it stuck on "processing" forever.
        try:
            import_batch = db.query(TelemetryImport).filter(TelemetryImport.id == import_id).first()
            if import_batch:
                import_batch.status = ImportStatus.failed
                db.commit()
        except Exception:
            log.exception("CSV import for device %s: failed to mark import batch %s as failed.", device_id, import_id)
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
        # pd.read_csv is a blocking, synchronous call - running it directly
        # in this async handler would stall the event loop (and every other
        # concurrent request/WebSocket tick) for the duration of the parse,
        # which matters once files get large. run_in_threadpool offloads it.
        df = await run_in_threadpool(pd.read_csv, io.StringIO(contents.decode('utf-8')))

        # Create the audit-trail row synchronously (before the background
        # task even starts) so it shows up in the Upload History panel
        # immediately, with a real id to hand the background task and to
        # return to the caller.
        import_batch = TelemetryImport(
            device_id=device_id,
            filename=file.filename or "upload.csv",
            uploaded_by_user_id=admin.id,
            status=ImportStatus.processing,
        )
        db.add(import_batch)
        db.commit()
        db.refresh(import_batch)

        df_json = df.to_json(orient="records")
        background_tasks.add_task(_process_import_in_background, device_id, df_json, import_batch.id)

        # _process_import_in_background caps at IMPORT_ROW_LIMIT rows - report
        # that truncation to the caller instead of the full uploaded count,
        # so a bigger file doesn't silently look fully imported.
        accepted_rows = min(len(df), IMPORT_ROW_LIMIT)
        message = "CSV upload accepted, processing in background."
        if len(df) > IMPORT_ROW_LIMIT:
            message += f" Only the first {IMPORT_ROW_LIMIT} of {len(df)} rows will be imported (demo limit)."

        return {
            "message": message,
            "rows": accepted_rows,
            "rows_uploaded": len(df),
            "import_id": import_batch.id,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")


# ── Upload History (CSV import audit trail) ─────────────────────────────────────
# Backs the "Data Sources" right-hand panel: which CSVs were imported into
# this device, when, by whom, and whether they're currently feeding its
# analytics. See TelemetryImport in models.py and _visible_telemetry_query
# above for how "included" propagates into every other endpoint.

class ToggleImportRequest(BaseModel):
    included: bool


@router.get("/imports")
def list_imports(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = get_scoped_device(device_id, current_user, db)
    rows = (
        db.query(TelemetryImport)
        .filter(TelemetryImport.device_id == device.id)
        .order_by(TelemetryImport.uploaded_at.desc())
        .all()
    )
    return [_import_to_dict(r) for r in rows]


@router.patch("/imports/{import_id}")
def toggle_import(
    device_id: int,
    import_id: int,
    body: ToggleImportRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: include/exclude this CSV's rows from the device's analytics."""
    imp = (
        db.query(TelemetryImport)
        .filter(TelemetryImport.id == import_id, TelemetryImport.device_id == device_id)
        .first()
    )
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    imp.included = body.included
    db.commit()
    db.refresh(imp)
    return _import_to_dict(imp)


@router.delete("/imports/{import_id}")
def delete_import(
    device_id: int,
    import_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: permanently delete this CSV batch and every telemetry row it wrote."""
    imp = (
        db.query(TelemetryImport)
        .filter(TelemetryImport.id == import_id, TelemetryImport.device_id == device_id)
        .first()
    )
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    # Telemetry.import_id is ON DELETE CASCADE (see models.py), so deleting
    # the batch row also deletes every Telemetry row it wrote, and each of
    # those cascades to its own CellReadings the same way Device deletion
    # already does further up the chain.
    db.delete(imp)
    db.commit()
    return {"deleted": True, "import_id": import_id}


@router.get("/imports/{import_id}/preview")
def preview_import(
    device_id: int,
    import_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Signal summary + a handful of sample rows for the panel's "View" action -
    lets someone confirm what a CSV actually contains without re-opening the
    original file.
    """
    device = get_scoped_device(device_id, current_user, db)
    imp = (
        db.query(TelemetryImport)
        .filter(TelemetryImport.id == import_id, TelemetryImport.device_id == device.id)
        .first()
    )
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")

    rows = (
        db.query(Telemetry)
        .filter(Telemetry.import_id == imp.id)
        .options(joinedload(Telemetry.cell_readings))
        .order_by(Telemetry.sample_time.asc())
        .limit(20)
        .all()
    )
    has_cells = any(r.cell_readings for r in rows)
    return {
        "import": _import_to_dict(imp),
        "signals": {
            "voltage": any(r.pack_voltage is not None for r in rows),
            "current": any(r.pack_current is not None for r in rows),
            "soc": any(r.soc is not None for r in rows),
            "soh": any(r.soh is not None for r in rows),
            "cell_voltage": has_cells,
            "cell_temp": any(cr.temperature_c is not None for r in rows for cr in r.cell_readings),
            "location": any(r.latitude is not None for r in rows),
            "cell_count": max((len(r.cell_readings) for r in rows), default=0),
        },
        "sample_rows": [_telemetry_to_dict(r, include_cells=False) for r in rows],
    }
