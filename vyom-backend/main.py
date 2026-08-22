"""
VYOM Backend — FastAPI Application Entry Point
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import logging

from core.database import init_db
from core.architecture_seed import seed_architectures
from api.missions import router as missions_router
from api.faults import router as faults_router
from api.telemetry import telemetry_router, blackbox_router, commands_router
from api.reports import router as reports_router
from api.websocket import websocket_endpoint

# v3.0 New Routers
from api.incidents import router as incidents_router
from api.crew import router as crew_router
from api.risk import router as risk_router
from api.objectives import router as objectives_router
from api.activities import router as activities_router
from api.trajectory_api import router as trajectory_router
from api.farewell_api import router as farewell_router
from api.architectures import router as architectures_router
from api.scenarios_api import router as scenarios_router
from api.timeline_api import router as timeline_router
from api.orbital_api import router as orbital_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("vyom")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seeded = seed_architectures()
    logger.info("✓ VYOM Backend started — Database initialized (%d architectures seeded)", seeded)
    logger.info("✓ WebSocket endpoint: ws://localhost:8000/ws/{mission_id}")
    logger.info("✓ API docs: http://localhost:8000/docs")
    yield

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="VYOM Mission Digital Twin Backend",
    description="Authoritative simulation backend for VYOM space mission platform",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Wildcard origin + credentials is not allowed by the CORS spec. The app does
# not use cookies, so credentials stay disabled; lock origins down in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Frontend on any port
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Routers ──────────────────────────────────────────────────────────────
app.include_router(missions_router)
app.include_router(faults_router)
app.include_router(telemetry_router)
app.include_router(blackbox_router)
app.include_router(commands_router)
app.include_router(reports_router)

# v3.0 New Routers
app.include_router(incidents_router)
app.include_router(crew_router)
app.include_router(risk_router)
app.include_router(objectives_router)
app.include_router(activities_router)
app.include_router(trajectory_router)
app.include_router(farewell_router)
app.include_router(architectures_router)
app.include_router(scenarios_router)
app.include_router(timeline_router)
app.include_router(orbital_router)


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/{mission_id}")
async def ws_endpoint(mission_id: str, websocket: WebSocket):
    await websocket_endpoint(mission_id, websocket)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    from simulation.loop import _simulations
    return {
        "status": "operational",
        "version": "2.0.0",
        "active_simulations": len(_simulations),
        "simulation_ids": list(_simulations.keys()),
    }


@app.get("/")
def root():
    return {
        "service": "VYOM Mission Digital Twin Backend",
        "status": "running",
        "docs": "http://localhost:8000/docs",
        "ws": "ws://localhost:8000/ws/{mission_id}",
    }
