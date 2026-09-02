# VYOM System Architecture

```mermaid
graph TB
    subgraph Frontend["🖥️ VYOM Frontend (React 19 + Vite)"]
        App["App.tsx<br/>Screen Router + Navigation"]
        Screens["22 Screen Components"]
        ThreeJS["Three.js 3D Scenes<br/>SatelliteScene · SpaceScene<br/>CrewAnatomyScene · OrbitalTrackingPanel"]
        Zustand["Zustand Store<br/>missionStore.ts"]
        Engines["Frontend Engines<br/>15 simulation modules"]
        UI["UI Components<br/>Navigation · HealthRing<br/>TelemetryMini · Earth BG"]
        Services["Frontend Services<br/>WebSocket · Supabase<br/>Persistence · Orbital Propagation"]
    end

    subgraph Backend["⚙️ VYOM Backend (FastAPI 0.115 / Python 3.11)"]
        Main["main.py<br/>FastAPI App v3.0"]
        APIRouters["16 API Routers<br/>missions · faults · telemetry<br/>incidents · crew · risk<br/>objectives · activities · trajectory<br/>farewell · architectures · scenarios<br/>timeline · orbital · reports · websocket"]
        CoreEngines["Core Engine Modules<br/>AI Guardian · Anomaly Detector<br/>Command Engine · Crew Health<br/>Daily Summary · Environment<br/>Fault · Incident · Manual Recovery<br/>Recovery · Risk · RUL<br/>Scenario · Spacecraft State<br/>Telemetry · TLE · Trajectory"]
        CoreLibs["Core Libraries<br/>Database (SQLAlchemy)<br/>Schemas (Pydantic)<br/>BlackBox Recorder<br/>Architecture Seed<br/>Report Builder · Migrations"]
        Simulation["Simulation Loop<br/>loop.py"]
        Physics["Physics Engine<br/>Orbital Propagation<br/>Keplerian Two-Body<br/>Drag · J2 Perturbation"]
    end

    subgraph External["☁️ External Services"]
        Supabase["Supabase<br/>Database + Auth + Realtime"]
        Render["Render.com<br/>Frontend Static + Backend Web"]
    end

    App --> Screens
    App --> ThreeJS
    App --> UI
    Zustand --> Engines
    Services --> Supabase
    Screens --> Engines
    Screens --> Services

    Main --> APIRouters
    Main --> CoreEngines
    Main --> CoreLibs
    Main --> Simulation
    CoreEngines --> Physics
    CoreLibs --> Simulation
    APIRouters --> CoreEngines

    Frontend <-->|"WebSocket 10Hz / REST API"| Backend
    Backend <-->|"SQLAlchemy ORM"| Supabase
    Frontend <-->|"npm run build"| Render
    Backend <-->|"uvicorn"| Render
```

## Technology Stack

```mermaid
flowchart LR
    A[Frontend] -->|React 19| B(TypeScript)
    A -->|Vite 8| C(@react-three/fiber)
    A -->|Three.js| D(framer-motion)
    A -->|Recharts| E(d3)
    A -->|Zustand| F(idb)
    A -->|jsPDF| G(@supabase/supabase-js)

    H[Backend] -->|FastAPI| I(Uvicorn)
    H -->|SQLAlchemy 2.0| J(NumPy / SciPy)
    H -->|WebSockets| K(Pydantic)
    H -->|ReportLab| L(Python-Multipart)
    H -->|Alembic| M(httpx)
```

## Deployment Architecture

```mermaid
graph LR
    User([User Browser]) -->|HTTPS| Render
    Render -->|Static Hosting| Frontend[vyom-digital-twin-frontend<br/>Vite Build → ./dist]
    Render -->|Web Service| Backend[vyom-digital-twin-backend<br/>Uvicorn :8000<br/>Free Tier Oregon]
    Frontend -->|VITE_BACKEND_API_URL| Backend
    Frontend -->|VITE_BACKEND_WS_URL| Backend
    Backend -->|Connection| Supabase[(Supabase DB)]
```
