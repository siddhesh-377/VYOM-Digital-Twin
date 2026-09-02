# VYOM Digital Twin Architecture & Synchronization

This document diagrams how the **1:1 Physics-Grounded Digital Twin** synchronizes real-time spacecraft telemetry, orbital propagation (J2 perturbation), 3D WebGL visualization, and bi-directional command telemetry.

---

## 1. Digital Twin Real-Time Synchronization Loop (10Hz / 100ms)

```mermaid
flowchart TB
    subgraph Spacecraft["🛰️ Spacecraft Physical State Model"]
        OrbState["Orbital Mechanics<br/>• r, v vectors (ECI)<br/>• Keplerian Elements<br/>• J2 Earth Oblateness<br/>• Atmospheric Drag"]
        PowerState["Power Subsystem (EPS)<br/>• GaAs Triple-Junction PV<br/>• Li-Ion Battery Equivalent (ODE)<br/>• Bus Voltage & Solar Vector"]
        ThermalState["Thermal Subsystem (TCS)<br/>• Multi-Node Heat Transfer<br/>• Direct Sun / Albedo / Earth IR<br/>• Radiator & Heater Duty"]
        ADCSState["Attitude & Pointing (ADCS)<br/>• Quaternions & Euler Rates<br/>• Reaction Wheel RPM<br/>• Sun-Tracking Solar Panels"]
    end

    subgraph SyncEngine["⚡ Digital Twin Synchronization Engine"]
        Tick["Simulation Clock / Warp Engine<br/>1× to 7,200× Time Dilation"]
        StateAggregator["SpacecraftState Aggregator<br/>Atomic Immutable Snapshot"]
        KalmanFilter["Noise & Sensor Model<br/>Kalman Filter / 3σ Bound"]
        Ledger["Black Box Recorder<br/>Ring Buffer + IndexedDB"]
    end

    subgraph Renderer3D["🪐 Three.js / WebGL Spatial Environment"]
        ThreeCanvas["Canvas Scene Router"]
        EarthMesh["Photorealistic Earth & Atmosphere<br/>Rayleigh/Mie Atmospheric Glow"]
        SatMesh["DynamicSpacecraftModel.tsx<br/>• Articulated Solar Arrays<br/>• RCS Thruster Particle Emitters<br/>• High-Gain Antenna Vector"]
        OrbitMesh["OrbitalTrackRenderer<br/>• Ground Track (Lat/Lon Footprint)<br/>• True Anomaly Marker<br/>• Day/Night Eclipse Terminator"]
    end

    subgraph Operators["👨‍🚀 Operator Telemetry & HUD"]
        HUD["12-Channel Real-Time HUD"]
        AI["VYOM AI Copilot Assistant"]
        ThreatMap["Threat & Collision Radar"]
    end

    OrbState --> StateAggregator
    PowerState --> StateAggregator
    ThermalState --> StateAggregator
    ADCSState --> StateAggregator

    Tick --> StateAggregator
    StateAggregator --> KalmanFilter
    KalmanFilter --> Ledger
    KalmanFilter --> ThreeCanvas

    ThreeCanvas --> EarthMesh
    ThreeCanvas --> SatMesh
    ThreeCanvas --> OrbitMesh

    StateAggregator --> HUD
    StateAggregator --> AI
    StateAggregator --> ThreatMap
```

---

## 2. Orbital Mechanics & Two-Body Propagation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Clock as MissionClockEngine (Warp Tick)
    participant Orbit as OrbitEngine (Keplerian/J2)
    participant Env as SpaceEnvironmentEngine
    participant Twin as DigitalTwinEngine
    participant Three as Three.js Canvas / OrbitView

    Clock->>Orbit: stepTime(dt * warpFactor)
    Orbit->>Orbit: Solve Kepler's Equation for Mean Anomaly (M = n * t)
    Orbit->>Orbit: Newton-Raphson Iteration -> Eccentric Anomaly (E)
    Orbit->>Orbit: True Anomaly (ν) & Radial Distance (r)
    Orbit->>Orbit: Apply J2 Nodal Precession (dΩ/dt) & Argument of Perigee (dω/dt)
    
    Orbit->>Env: Calculate Sun Vector & Earth Shadow Geometry
    Env->>Env: Ray-Sphere Intersection (Sun -> Spacecraft -> Earth)
    Env-->>Twin: Eclipse Factor (1.0 = Sunlight, 0.0 = Umbra, (0,1) = Penumbra)

    Orbit->>Twin: Transmit ECI Position [x, y, z] & Velocity [vx, vy, vz]
    Twin->>Three: Update Spacecraft Translation & Ground Track coordinates
    Three->>Three: Rotate Earth (15°/hr GMST) + Update Spacecraft Sub-Satellite Point
```

---

## 3. Dynamic Spacecraft Subsystem Dependency Graph

```mermaid
graph TD
    Sun["☀️ Solar Radiation & CME Flux"] -->|"Illumination"| PV["GaAs Solar Array Panels"]
    Sun -->|"Direct Solar Flux"| TCS["Thermal Control (Multi-Node)"]
    
    Orbit["🌍 Orbital Position (Altitude / Eclipse)"] -->|"Shadow Geometry"| PV
    Orbit -->|"Albedo & Earth IR"| TCS
    Orbit -->|"Drag & J2 Torque"| ADCS["Attitude Determination & Control (ADCS)"]

    PV -->|"Generated Power [Watts]"| EPS["Electrical Power System (EPS)"]
    EPS -->|"Charge Current"| Battery["Li-Ion Battery Cells (ODE SOC)"]
    EPS -->|"Bus Voltage"| Subsystems["Avionics & Science Payloads"]
    EPS -->|"Heater Power"| TCS

    TCS -->|"Temperature Effects"| Battery
    TCS -->|"TWTA Thermal Noise"| Comm["RF Communication (Link Budget)"]

    ADCS -->|"Reaction Wheel Spin Rate"| Gyro["Inertial Sensor Suite"]
    ADCS -->|"Solar Vector Tracking"| PV

    Subsystems -->|"Power Consumption"| EPS
    Comm -->|"Ground Station Elevation Window"| Ground["Ground Station Pass"]
```
