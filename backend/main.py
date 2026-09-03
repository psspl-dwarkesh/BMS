"""
Main FastAPI application entrypoint.

Wires up the routers, configures CORS from .env, manages the background
simulator lifecycle, and handles static file serving.
"""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from config import settings
from database import engine, Base
from ws_manager import manager
from simulator import start_simulator, stop_simulator

# Import all APIRouters
from routers import (
    auth, users, devices, telemetry, location, alerts, predict
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("bms.main")

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist (we rely on seed.py for initial data, but create_all is safe)
    Base.metadata.create_all(bind=engine)
    
    # Auto-seed the database if it's completely empty (e.g. fresh Render deploy)
    from database import SessionLocal
    from models import User
    import seed
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            seed.seed_database()
    finally:
        db.close()
        

    if settings.SIMULATOR_ENABLED:
        await start_simulator(tick_seconds=settings.SIMULATOR_TICK_SECONDS)
    
    yield
    
    if settings.SIMULATOR_ENABLED:
        await stop_simulator()


app = FastAPI(title="Enterprise BMS API", lifespan=lifespan)


# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,  # We use Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(telemetry.router)
app.include_router(location.router)
app.include_router(alerts.router)
app.include_router(predict.router)


@app.get("/api")
def read_root():
    return {"status": "Enterprise BMS API is running", "simulator": settings.SIMULATOR_ENABLED}


# ── WebSockets ────────────────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    Unified WebSocket endpoint for both ALERTS and TELEMETRY_UPDATES.
    Requires ?token=<jwt> for authentication.
    """
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    from routers import decode_token
    import jwt
    from database import SessionLocal
    from models import User

    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", 0))
        
        # Verify user still exists/active and get their device assignments
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
            if not user:
                await websocket.close(code=4001, reason="Invalid user")
                return
            
            from routers import get_user_device_ids
            device_ids = get_user_device_ids(user, db)
            role = user.role.value
        finally:
            db.close()
            
        await manager.accept_authenticated(websocket, user_id, role, device_ids)
        
        while True:
            # Keep connection alive, can accept client pings here
            _ = await websocket.receive_text()
            
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid token")
    except WebSocketDisconnect:
        manager.remove(websocket)


# ── Static File Serving (SPA Fallback) ────────────────────────────────────────

app.mount("/", StaticFiles(directory="../bms-portal/dist", html=True), name="static")

@app.exception_handler(404)
async def catch_all_for_spa(request, exc):
    """
    Any 404 falling through the API routers should serve the React SPA index.html,
    allowing react-router to handle the route on the client side.
    """
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return FileResponse("../bms-portal/dist/index.html")
