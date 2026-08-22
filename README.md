# 🛰️ VYOM: Next-Gen Autonomous Space Mission Digital Twin

[![Vite](https://img.shields.io/badge/Vite-8.2.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.185-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?logo=render&logoColor=black)](https://render.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**VYOM** is an aerospace-grade **Digital Twin Platform and Autonomous Mission Operator** designed for complex satellite operations, deep-space trajectories, and human crewed spaceflight. 

It pairs an **Authoritative 10Hz Python/FastAPI Physics Server** with a high-fidelity **React/WebGL Digital Twin Client**, featuring deterministic flight constraint validation, multi-subsystem cascading failure propagation, Monte Carlo danger simulation, and real-time 3D/2D digital twin visualization.

---

## 🌟 Key Features & Subsystems

### 1. 🕹️ Mission Control & 3D Satellite Digital Twin
* **Keplerian Trajectory Kinematics**: Real-time orbital propagation with altitude, orbital period, velocity ($7.53\text{ km/s}$), inclination ($51.6^\circ$), and geodetic ground tracking.
* **Interactive 3D WebGL Spacecraft**: Real-time 3D satellite model with orbit inclination lines, dynamic sun illumination, and particle starfields.
* **12-Channel Telemetry HUD**: Live power metrics (GaAs solar generation, battery DoD, bus voltage), thermal loops (CPU junction, battery, payload temps), and RF link budgets (dBm, SNR, bitrate).
* **Ultra Warp Acceleration**: Simulate missions from real-time $1\times$ up to $864,000\times$ ($10\text{ mission days/sec}$) with automatic mission completion transitions.

### 2. 👨‍🚀 Crew Physiological Digital Twin
* **2D Transparent Anatomical Reference Twin**: Interactive human anatomical digital twin displaying layered cardiovascular, respiratory, nervous, and muscular states.
* **Real-Time Astronaut Biometrics**: Dynamic monitoring of heart rate (BPM), blood oxygen saturation ($\text{SpO}_2$), radiation dose ($\text{mSv}$), and metabolic activity.
* **Environmental Biosphere Coupling**: Automatically correlates solar flares and cabin pressure drops to physiological stress indices.

### 3. 🤖 Autonomous AI Mission Operator
* **Telemetry Anomaly Isolation**: Continuous 10Hz statistical bounds testing and Kalman filter variance isolation.
* **Multi-Subsystem Cascading Failure Modeling**: Evaluates how faults cascade across subsystems (e.g. $40\%$ solar flux drop $\to$ $3.2\times$ battery drain $\to$ $-15^\circ\text{C}$ thermal contraction $\to$ RF TWTA half-power mode $\to$ mission lifetime reduction).
* **Internal Candidate Evaluation**: Automatically simulates 3 candidate recovery actions, computes expected utility scores, and selects the optimal solution without stalling on user prompts.
* **Automatic Digital Twin Dispatch**: Dispatches validated state mutations directly to hardware and confirms 3-sigma sensor recovery.
* **Explainable Aerospace Briefing**: Logs structured 4-block briefings (`[ANOMALY]`, `[ROOT CAUSE]`, `[FAILURE PROPAGATION]`, `[ACTION EXECUTED]`, `[RECOVERY STATUS]`).

### 4. 🛡️ Deterministic Aerospace Safety & Constraint Engine
* Enforces physical boundary envelopes via `SafetyValidator` before any command is executed:
  * **Power / EPS**: Battery $\text{SoC} \ge 20.0\%$, Main Bus $\ge 22.0\text{V}$.
  * **Thermal / TCS**: $T_{\text{CPU}} \le 85.0^\circ\text{C}$, $T_{\text{BATT}} \le 45.0^\circ\text{C}$, $T_{\text{PAYLOAD}} \le 65.0^\circ\text{C}$.
  * **Attitude / GNC**: Body angular rates $\omega \le 3.5^\circ/\text{s}$, Reaction Wheel $\le 6200\text{ RPM}$.
  * **Life Support / ECLSS**: Cabin Pressure $\ge 70.0\text{ kPa}$, Oxygen Partial Pressure $\text{PO}_2 \in [19.5, 23.5]\text{ kPa}$.

### 5. ⚠️ AI Danger Simulation & Decision Support
* **Multi-Strategy Probabilistic Evaluation**: Ingests emergencies and presents 3–5 strategic response options with success/failure probabilities, resource drains, and secondary risks.
* **"Why This Option?" Analytical Deep Dive**: Inspect positive factors, risk trade-offs, and AI ranking rationales.
* **5-Stage Monte Carlo Branching Simulation**: Step-by-step resolution ($\text{SUCCESS} \to \text{PARTIAL} \to \text{UNSTABLE} \to \text{FAILURE}$) with dynamic contingency rerouting.
* **SVG Vector Decision Tree**: Interactive visual decision tree diagram and side-by-side What-If comparison matrix.

### 6. 🏗️ Spacecraft Architecture Blueprint Viewer
* **Full-Bleed Responsive Topology Workspace**: Interactive vector diagram spanning Power/EPS, Avionics C&DH, GNC/ADCS, RF Comms, Thermal Loops, Propulsion, ECLSS, and Payloads.
* **Dynamic Vector `viewBox` Zoom Engine**: Razor-sharp zooming from $40\%$ up to $350\%$ magnification with mouse wheel zoom, click-and-drag pan, preset zoom buttons, and floating HUD.

### 7. 📑 Health & Integrity Reporting Dossier
* **Interactive Sub-Tabs**: Executive Summary, Health & Integrity Audit, Incidents & Recovery, and Flight Milestones.
* **Multi-Stream Calibrated Graphs**: High-accuracy dual-axis Battery & Power Profile and Spacecraft Integrity Profile curves.
* **Dual-Mode PDF Export**: Official Aerospace Mission Dossier generation via client-side jsPDF or backend ReportLab.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VYOM FRONTEND (React 19 + TypeScript)                │
│    3D Three.js Visualizer · 2D Anatomy Twin · SVG Topology Zoom Engine  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                     WebSocket 10Hz  │  REST APIs (/api/missions)
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                  FASTAPI AUTHORITATIVE 10Hz PHYSICS SERVER              │
├─────────────────────────────────────────────────────────────────────────┤
│ • Orbital Physics Engine (Keplerian two-body, drag, J2 perturbation)   │
│ • Space Environment Engine (Solar flux, CMEs, Van Allen belts, eclipse)│
│ • Telemetry Synthesis Engine (GaAs PV curve, battery ODEs, link budget) │
│ • Fault & Threat Injection Engine (Realistic hardware failure models)  │
│ • AI Autonomous Operator Kernel (Anomaly isolation, propagation model)  │
│ • Deterministic Aerospace Safety Engine (Flight rule boundaries)       │
│ • Persistence & Black Box (SQLAlchemy ORM + SQLite / PostgreSQL)       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack & Zero-API-Cost Design

* **Zero External API Costs ($0)**: Completely self-contained. No third-party LLM cloud API fees, map tile subscriptions, or external rate limits.
* **Frontend**: React 19, TypeScript, Vite, `@react-three/fiber`, `@react-three/drei`, `three`, `framer-motion`, `recharts`, `d3`, `zustand`, `idb`, `jspdf`.
* **Backend**: Python 3.11+, FastAPI, Uvicorn, WebSockets, SQLAlchemy 2.0, Alembic, NumPy, SciPy, ReportLab.

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/siddhesh-377/VYOM-Digital-Twin.git
cd VYOM-Digital-Twin
```

### 2. Frontend Setup (Client & Local Simulation)
```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev
```
Open **`http://localhost:5173/`** in your browser.

### 3. Backend Setup (Optional 10Hz Physics Server)
```bash
# Navigate to backend directory
cd vyom-backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start backend server
python run.py
```
The FastAPI backend will start at **`http://localhost:8000`** with interactive API docs at **`http://localhost:8000/docs`**.

---

## ☁️ Deployment on Render

This repository includes a native **`render.yaml`** Blueprint for one-click deployment:

1. Log into **[dashboard.render.com](https://dashboard.render.com/)**.
2. Click **New +** ➔ **Blueprint**.
3. Select your repository: **`siddhesh-377/VYOM-Digital-Twin`**.
4. Click **Apply**.
5. Render will automatically build and launch both the **Frontend Static Web App** and the **FastAPI Physics Web Service** on free tiers with automated SPA routing!

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
