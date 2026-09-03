"""Prediction router — ML inference endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Telemetry, User
from routers import get_current_user, get_scoped_device
import ml_inference

router = APIRouter(prefix="/api/v1/devices/{device_id}/predict", tags=["predict"])


@router.post("/rul")
def predict_rul(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    SOH / RUL prediction using the trained RandomForestRegressor.
    Aligns with the new schema (device_id in path, auth, real sample_time).
    """
    device = get_scoped_device(device_id, current_user, db)

    # Fetch the last 200 telemetry rows for this device, ordered chronologically
    telemetry = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device.id)
        .order_by(Telemetry.sample_time.asc())
        .limit(200)
        .all()
    )

    if not telemetry or len(telemetry) < 10:
        raise HTTPException(status_code=422, detail="Insufficient telemetry data for RUL prediction. Need at least 10 samples.")

    voltage_data = [t.pack_voltage for t in telemetry if t.pack_voltage is not None]
    current_data = [t.pack_current for t in telemetry if t.pack_current is not None]
    temp_data    = [t.avg_cell_temp for t in telemetry if t.avg_cell_temp is not None]

    # For ml_inference, if lists are short due to nulls, pad or error
    min_len = min(len(voltage_data), len(current_data), len(temp_data))
    if min_len < 10:
        raise HTTPException(status_code=422, detail="Insufficient non-null telemetry data for RUL prediction.")

    # Pass the real elapsed times (in seconds) to the feature extractor if it supported it.
    # ml_inference.py currently uses ASSUMED_SAMPLE_INTERVAL_SECONDS internally for CSVs
    # lacking real timestamps. We'll pass the lists directly for now as per the original.
    
    prediction = ml_inference.run_rul_inference(
        voltage_data[:min_len], 
        current_data[:min_len], 
        temp_data[:min_len]
    )

    return prediction
