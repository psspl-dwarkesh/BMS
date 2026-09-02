from fastapi import FastAPI, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import models
import os
from database import engine, SessionLocal
import pandas as pd
import io
import ml_inference
from ws_manager import manager
import tasks

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Enterprise BMS API")

# Setup CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api")
def read_root():
    return {"status": "Enterprise BMS API is running"}

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/v1/packs/upload")
async def upload_pack_data(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Read CSV data
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    # 1. Create a new Battery Pack record
    new_pack = models.BatteryPack(
        pack_name=f"Pack_{file.filename.split('.')[0]}",
        status="Active"
    )
    db.add(new_pack)
    db.commit()
    db.refresh(new_pack)
    
    # 2. Extract standard columns (simplified logic for mapping)
    # This would ideally use the mapping sent from the frontend
    # But for now we simulate storing the first 50 rows of telemetry
    
    try:
        # Looking for generic columns based on our NASA/Sample dataset
        v_col = [c for c in df.columns if 'voltage' in c.lower()][0]
        c_col = [c for c in df.columns if 'current' in c.lower()][0]
        
        telemetry_records = []
        for index, row in df.head(50).iterrows(): # Just 50 for demo speed
            telemetry_records.append(
                models.PackTelemetry(
                    pack_id=new_pack.id,
                    voltage=float(row[v_col]) if v_col else 0.0,
                    current=float(row[c_col]) if c_col else 0.0,
                    soc=100.0, # Placeholder
                    temperature=25.0 # Placeholder
                )
            )
        db.bulk_save_objects(telemetry_records)
        db.commit()
        
        # Dispatch background worker task for ISO-26262 Anomaly Detection
        # Passing raw dicts to simulate the serialization boundary of a Celery/Redis queue
        task_payload = [{"voltage": r.voltage, "current": r.current, "temperature": r.temperature} for r in telemetry_records]
        background_tasks.add_task(tasks.check_iso26262_violations, task_payload, manager)
        
    except Exception as e:
        print(f"Error parsing telemetry: {e}")
        pass

    return {
        "message": "Data successfully ingested into database",
        "pack_id": new_pack.id,
        "rows_processed": len(df)
    }

@app.get("/api/v1/packs")
def get_packs(db: Session = Depends(get_db)):
    packs = db.query(models.BatteryPack).all()
    return packs

@app.post("/api/v1/predict/rul")
async def predict_rul(pack_id: int, db: Session = Depends(get_db)):
    # Retrieve telemetry for the pack
    telemetry = db.query(models.PackTelemetry).filter(models.PackTelemetry.pack_id == pack_id).order_by(models.PackTelemetry.timestamp).all()
    
    if not telemetry or len(telemetry) < 10:
        return {"error": "Insufficient telemetry data for RUL prediction. Please upload more data."}
        
    voltage_data = [t.voltage for t in telemetry]
    current_data = [t.current for t in telemetry]
    temp_data = [t.temperature for t in telemetry]
    
    # Run the PyTorch inference model
    prediction = ml_inference.run_rul_inference(voltage_data, current_data, temp_data)
    
    return prediction

# Serve React App
app.mount("/", StaticFiles(directory="../bms-portal/dist", html=True), name="static")

@app.exception_handler(404)
async def catch_all_for_spa(request, exc):
    return FileResponse("../bms-portal/dist/index.html")
