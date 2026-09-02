# VYOM Frontend Architecture

## App Component Tree

```mermaid
graph TD
    App["App.tsx<br/>React 19 Root<br/>Global CSS + Background"] --> ScreenRouter["ScreenRouter<br/>AnimatePresence + motion.div"]
    App --> Navigation["Navigation.tsx<br/>Top-level nav bar"]

    ScreenRouter --> Welcome["WelcomeScreen"]
    ScreenRouter --> Onboarding["OnboardingScreen"]
    ScreenRouter --> Budget["BudgetScreen"]
    ScreenRouter --> LaunchLocation["LaunchLocationScreen"]
    ScreenRouter --> SatelliteGen["SatelliteGenerationScreen"]
    ScreenRouter --> LaunchSeq["LaunchSequenceScreen"]
    ScreenRouter --> MissionControl["MissionControlScreen"]
    ScreenRouter --> Crew["CrewScreen<br/>(config.type === 'human')"]
    ScreenRouter --> Planning["MissionPlanningScreen"]
    ScreenRouter --> Architecture["ArchitectureSelectionScreen"]
    ScreenRouter --> DigitalTwin["DigitalTwinScreen"]
    ScreenRouter --> Orbit["OrbitScreen"]
    ScreenRouter --> Universe["UniverseScreen"]
    ScreenRouter --> Telemetry["TelemetryScreen"]
    ScreenRouter --> Environment["EnvironmentScreen"]
    ScreenRouter --> Scenarios["ScenariosScreen"]
    ScreenRouter --> Danger["DangerDecisionScreen"]
    ScreenRouter --> AIScreen["AIScreen"]
    ScreenRouter --> MissionTime["MissionTimeScreen"]
    ScreenRouter --> Timeline["TimelineScreen"]
    ScreenRouter --> BlackBox["BlackBoxScreen"]
    ScreenRouter --> Replay["ReplayScreen"]
    ScreenRouter --> Reports["ReportsScreen"]
    ScreenRouter --> Archive["ArchiveScreen"]
    ScreenRouter --> Completion["CompletionScreen"]
    ScreenRouter --> Disposition["DispositionScreen"]
    ScreenRouter --> Farewell["FarewellScreen"]

    ScreenRouter -->|MISSION_COMPLETE event| Completion
```

## Screen Categorization

```mermaid
graph LR
    Root["🖥️ 22 VYOM Screens"] --> C1["Onboarding Phase"]
    Root --> C2["Launch Phase"]
    Root --> C3["Mission Operations"]
    Root --> C4["Orbit & Space Environment"]
    Root --> C5["Telemetry & Analysis"]
    Root --> C6["AI & Danger Decisions"]
    Root --> C7["Crew & Spacecraft Architecture"]
    Root --> C8["Ledger, Reports & Replay"]
    Root --> C9["Mission Farewell"]

    C1 --> WelcomeScreen["WelcomeScreen"]
    C1 --> OnboardingScreen["OnboardingScreen"]
    C1 --> BudgetScreen["BudgetScreen"]

    C2 --> LaunchLocationScreen["LaunchLocationScreen"]
    C2 --> SatelliteGenScreen["SatelliteGenerationScreen"]
    C2 --> LaunchSeqScreen["LaunchSequenceScreen"]

    C3 --> MissionControlScreen["MissionControlScreen"]
    C3 --> PlanningScreen["MissionPlanningScreen"]
    C3 --> MissionTimeScreen["MissionTimeScreen"]
    C3 --> TimelineScreen["TimelineScreen"]

    C4 --> OrbitScreen["OrbitScreen"]
    C4 --> UniverseScreen["UniverseScreen"]
    C4 --> EnvironmentScreen["EnvironmentScreen"]

    C5 --> TelemetryScreen["TelemetryScreen"]
    C5 --> ScenariosScreen["ScenariosScreen"]
    C5 --> ReportsScreen["ReportsScreen"]
    C5 --> ArchiveScreen["ArchiveScreen"]

    C6 --> AIScreen["AIScreen"]
    C6 --> DangerScreen["DangerDecisionScreen"]

    C7 --> CrewScreen["CrewScreen"]
    C7 --> ArchScreen["ArchitectureSelectionScreen"]

    C8 --> BlackBoxScreen["BlackBoxScreen"]
    C8 --> ReplayScreen["ReplayScreen"]
    C8 --> CompletionScreen["CompletionScreen"]

    C9 --> DispositionScreen["DispositionScreen"]
    C9 --> FarewellScreen["FarewellScreen"]
```

## Component Hierarchy by Category

```mermaid
graph TB
    subgraph "3D / WebGL"
        ThreeJS["Three.js Components"]
        ThreeJS --> SatelliteScene
        ThreeJS --> SpaceScene
        ThreeJS --> CrewAnatomyScene
        ThreeJS --> DynamicSpacecraftModel
        ThreeJS --> OrbitalTrackingPanel
        ThreeJS --> SpacePathRenderer
        ThreeJS --> CelestialTextures
        ThreeJS --> MissionRiskPanel
        ThreeJS --> WhatIfComparison
    end

    subgraph "2D Screens"
        Screens["Screen Components"]
        Screens --> WelcomeScreen
        Screens --> TelemetryScreen
        Screens --> MissionControlScreen
        Screens --> ReportsScreen
        Screens --> AIScreen
    end

    subgraph "UI Primitives"
        UI["UI Components"]
        UI --> Navigation
        UI --> HealthRing
        UI --> TelemetryMini
        UI --> InteractiveEarthBackground
    end

    subgraph "Cinematics"
        Cinematics["Cinematic Components"]
        Cinematics --> MissionCinematicPlayer
        Cinematics --> MissionStorytellingScroll
    end

    ThreeJS -->|renders in| Screens
    UI -->|used by| Screens
    Cinematics -->|playback in| MissionControl
```

## State Management Flow

```mermaid
graph LR
    Store["Zustand Mission Store<br/>missionStore.ts"] -->|screen| SR["ScreenRouter"]
    Store -->|status| SR
    Store -->|config| SR
    Store -->|setScreen| Events["MissionEventBus"]
    Events -->|MISSION_COMPLETE| SR
    SR -->|auto-navigate| Completion["Completion Screen"]
```
