# VYOM Threat Detection & AI Autonomous Copilot Pipeline

This document visualizes the **Anomaly Detection Engine**, **Space Environment Threat Pipeline**, **VYOM AI Autonomous Copilot Decision Tree**, and **Safety Boundary Validation Chain**.

---

## 1. Threat Detection & Anomaly Isolation Pipeline

```mermaid
flowchart TD
    subgraph Sensors["📡 Real-Time Telemetry Stream"]
        T1["Power: Bus Volts, Solar W, Batt %"]
        T2["Thermal: Core °C, Battery °C, Payload °C"]
        T3["ADCS: Quaternions, Body Rates, RW RPM"]
        T4["RF: Signal dBm, SNR, BER"]
        T5["Space Env: Solar Flux, Kp Index, CME Speed"]
    end

    subgraph Detector["🔍 Anomaly Detection & Statistical Bounds"]
        BoundsCheck["Deterministic Bounds Check<br/>3σ Upper & Lower Dynamic Thresholds"]
        KalmanVariance["Kalman Filter Residual Monitoring<br/>Sensor Drift vs Real Physical Anomaly"]
        TrendAnalysis["Predictive Degradation Extrapolation<br/>Rate-of-Change (d/dt) Alert Trigger"]
    end

    subgraph ThreatClassifier["⚠️ Threat Classification & Severity Scoring"]
        CME["Solar Storm / CME Particle Influx"]
        Debris["Conjunction / Micrometeoroid Threat"]
        PowerDrop["Power Loss / Critical Battery Depletion"]
        ADCSFault["Attitude Loss / Momentum Desaturation"]
        ThermalRunaway["Thermal Excursion (Overheat/Freeze)"]
    end

    subgraph AICopilot["🤖 VYOM AI Autonomous Copilot"]
        ContextAssembler["Assemble Operational Context<br/>Orbit phase, Eclipse timer, Subsystem health"]
        GenCandidates["Synthesize 3 Candidate Recovery Options<br/>Option A (Conservative), Option B (Balanced), Option C (Aggressive)"]
        TradeStudy["Multi-Objective Utility Trade Study<br/>Risk vs Power vs Fuel vs Recovery Time"]
    end

    Sensors --> BoundsCheck
    Sensors --> KalmanVariance
    Sensors --> TrendAnalysis

    BoundsCheck --> ThreatClassifier
    KalmanVariance --> ThreatClassifier
    TrendAnalysis --> ThreatClassifier

    ThreatClassifier --> CME
    ThreatClassifier --> Debris
    ThreatClassifier --> PowerDrop
    ThreatClassifier --> ADCSFault
    ThreatClassifier --> ThermalRunaway

    CME --> ContextAssembler
    Debris --> ContextAssembler
    PowerDrop --> ContextAssembler
    ADCSFault --> ContextAssembler
    ThermalRunaway --> ContextAssembler

    ContextAssembler --> GenCandidates
    GenCandidates --> TradeStudy
```

---

## 2. Autonomous Decision & Safety Gate State Machine

```mermaid
stateDiagram-v2
    [*] --> NominalState : Spacecraft In Orbit

    NominalState --> AnomalyDetected : 3σ Boundary Violation
    
    state AnomalyDetected {
        [*] --> IsolateSubsystem
        IsolateSubsystem --> ClassifySeverity
        ClassifySeverity --> ComputeRUL : Remaining Useful Life Assessment
        ComputeRUL --> [*]
    }

    AnomalyDetected --> AIPlanGeneration : Threat Score ≥ Warning Threshold

    state AIPlanGeneration {
        [*] --> Candidate1_Conservative
        [*] --> Candidate2_Balanced
        [*] --> Candidate3_Aggressive
        Candidate1_Conservative --> UtilityScoring
        Candidate2_Balanced --> UtilityScoring
        Candidate3_Aggressive --> UtilityScoring
        UtilityScoring --> SelectOptimalPlan
        SelectOptimalPlan --> [*]
    }

    AIPlanGeneration --> SafetyBoundaryValidation : Submit Selected Plan

    state SafetyBoundaryValidation {
        [*] --> CheckPowerReserve : Battery SOC ≥ 20% & Bus ≥ 22V
        CheckPowerReserve --> CheckThermalLimits : Temp ≤ Safe Thresholds
        CheckThermalLimits --> CheckAngularRates : Body Rate ≤ 3.5°/s
        CheckAngularRates --> CheckCommWindow : Ground Station Contact Lock
        CheckCommWindow --> PlanApproved : All Checks PASS
        CheckCommWindow --> PlanRejected : Boundary Violated
    }

    SafetyBoundaryValidation --> ExecuteRecoveryAction : Plan Approved
    SafetyBoundaryValidation --> EscalateToDangerDecision : Plan Rejected or Critical Severity

    state ExecuteRecoveryAction {
        [*] --> SendCommands
        SendCommands --> ReorientSolarArrays
        SendCommands --> ShedNonCriticalLoads
        SendCommands --> DesaturateReactionWheels
        ReorientSolarArrays --> MonitorRecoveryTelemetry
        ShedNonCriticalLoads --> MonitorRecoveryTelemetry
        DesaturateReactionWheels --> MonitorRecoveryTelemetry
        MonitorRecoveryTelemetry --> [*]
    }

    ExecuteRecoveryAction --> NominalState : Subsystems Restored to Nominal
    EscalateToDangerDecision --> HumanOperatorIntervention : Operator Override / Danger Decision UI
    HumanOperatorIntervention --> NominalState : Operator Resolution
```

---

## 3. Black Box Immutable Audit Ledger

```mermaid
sequenceDiagram
    autonumber
    participant Engine as Simulation Engine
    participant EventBus as Mission Event Bus
    participant BB as BlackBoxRecorder (Ring Buffer)
    participant IDB as IndexedDB (Local Cache)
    participant Cloud as Supabase Postgres (Remote Ledger)

    Engine->>EventBus: Emit TELEMETRY_TICK / ANOMALY_TRIGGER / COMMAND_EXECUTED
    EventBus->>BB: Push Event Frame with ISO-8601 Timestamp + Cryptographic Hash
    BB->>BB: Append to In-Memory Circular Buffer (10,000 frames)
    
    critical Periodic Sync
        BB->>IDB: Batch Write Telemetry Frames (Local Offline-First)
        BB->>Cloud: Post Mission Audit Log (Realtime Sync)
        Cloud-->>BB: Acknowledge SHA-256 Checksum
    end

    Note over BB,Cloud: Immutable ledger accessible in Post-Mission Replay & PDF Reports
```
