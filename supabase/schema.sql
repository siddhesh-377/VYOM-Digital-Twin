-- ============================================================================
-- VYOM: Intelligent Digital Space Mission Twin & Autonomous Mission Control
-- Phase 1: Dedicated Supabase Database Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Missions Table
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    mission_type TEXT NOT NULL CHECK (mission_type IN ('human_exploration', 'orbital_observation', 'planetary_probe', 'astrophysics_observatory', 'human', 'orbital', 'planetary', 'astrophysics')),
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('configuring', 'active', 'paused', 'threatened', 'recovering', 'completed', 'failed')),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    target TEXT DEFAULT 'earth-orbit',
    budget_crore NUMERIC(10, 2) DEFAULT 0.0,
    launch_site JSONB DEFAULT '{}'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Spacecraft Table
CREATE TABLE IF NOT EXISTS spacecraft (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    mass_kg NUMERIC(10, 2) DEFAULT 1000.0,
    dimensions JSONB DEFAULT '{"length_m": 4.5, "width_m": 2.2, "height_m": 2.2}'::jsonb,
    launch_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'nominal',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Spacecraft Subsystems Table
CREATE TABLE IF NOT EXISTS spacecraft_subsystems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('power', 'thermal', 'adcs', 'propulsion', 'communication', 'payload', 'avionics', 'life_support')),
    status TEXT NOT NULL DEFAULT 'nominal' CHECK (status IN ('nominal', 'warning', 'critical', 'failed')),
    health_score NUMERIC(5, 2) DEFAULT 100.0 CHECK (health_score >= 0 AND health_score <= 100),
    configuration JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Telemetry Channels Table
CREATE TABLE IF NOT EXISTS telemetry_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    subsystem_id UUID REFERENCES spacecraft_subsystems(id) ON DELETE SET NULL,
    channel_name TEXT NOT NULL,
    unit TEXT DEFAULT '',
    min_value NUMERIC(10, 3),
    max_value NUMERIC(10, 3),
    warning_threshold NUMERIC(10, 3),
    critical_threshold NUMERIC(10, 3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Telemetry Readings Table
CREATE TABLE IF NOT EXISTS telemetry_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES telemetry_channels(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value NUMERIC(12, 4) NOT NULL,
    quality TEXT DEFAULT 'good' CHECK (quality IN ('good', 'degraded', 'stale', 'invalid')),
    source TEXT NOT NULL DEFAULT 'simulation' CHECK (source IN ('live', 'simulation', 'replay', 'prediction'))
);

-- 6. Spacecraft State Table
CREATE TABLE IF NOT EXISTS spacecraft_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    position_x NUMERIC(14, 4),
    position_y NUMERIC(14, 4),
    position_z NUMERIC(14, 4),
    velocity_x NUMERIC(10, 4),
    velocity_y NUMERIC(10, 4),
    velocity_z NUMERIC(10, 4),
    latitude NUMERIC(8, 4),
    longitude NUMERIC(8, 4),
    altitude NUMERIC(10, 2),
    attitude_roll NUMERIC(8, 4),
    attitude_pitch NUMERIC(8, 4),
    attitude_yaw NUMERIC(8, 4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Orbital State Table
CREATE TABLE IF NOT EXISTS orbital_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    semi_major_axis NUMERIC(12, 3),
    eccentricity NUMERIC(8, 6),
    inclination NUMERIC(8, 4),
    raan NUMERIC(8, 4),
    argument_of_perigee NUMERIC(8, 4),
    true_anomaly NUMERIC(8, 4),
    apoapsis NUMERIC(10, 2),
    periapsis NUMERIC(10, 2),
    orbital_period NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Trajectory Points Table
CREATE TABLE IF NOT EXISTS trajectory_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    position_x NUMERIC(14, 4),
    position_y NUMERIC(14, 4),
    position_z NUMERIC(14, 4),
    latitude NUMERIC(8, 4),
    longitude NUMERIC(8, 4),
    altitude NUMERIC(10, 2),
    velocity NUMERIC(10, 4),
    trajectory_type TEXT DEFAULT 'observed' CHECK (trajectory_type IN ('observed', 'predicted', 'transfer', 'target')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Mission Events Table
CREATE TABLE IF NOT EXISTS mission_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'nominal' CHECK (severity IN ('nominal', 'warning', 'critical', 'fatal')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    affected_subsystem TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Anomalies Table
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    spacecraft_id UUID NOT NULL REFERENCES spacecraft(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subsystem TEXT NOT NULL,
    channel TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_value NUMERIC(12, 4),
    expected_range TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'mitigating', 'resolved', 'timeout')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Anomaly Predictions Table
CREATE TABLE IF NOT EXISTS anomaly_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anomaly_id UUID NOT NULL REFERENCES anomalies(id) ON DELETE CASCADE,
    predicted_time TIMESTAMPTZ NOT NULL,
    probability NUMERIC(5, 2) NOT NULL CHECK (probability >= 0 AND probability <= 100),
    predicted_effect TEXT NOT NULL,
    confidence NUMERIC(5, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    anomaly_id UUID REFERENCES anomalies(id) ON DELETE SET NULL,
    recommendation TEXT NOT NULL,
    reasoning TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'immediate')),
    confidence NUMERIC(5, 2) DEFAULT 90.0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Simulation Runs Table
CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    scenario TEXT NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('pending', 'running', 'completed', 'aborted')),
    results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Ground Stations Table
CREATE TABLE IF NOT EXISTS ground_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    latitude NUMERIC(8, 4) NOT NULL,
    longitude NUMERIC(8, 4) NOT NULL,
    elevation_m NUMERIC(8, 2) DEFAULT 0.0,
    min_elevation_deg NUMERIC(4, 1) DEFAULT 5.0,
    comm_band TEXT DEFAULT 'S/X/Ka-Band',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_spacecraft_mission_id ON spacecraft(mission_id);
CREATE INDEX IF NOT EXISTS idx_subsystems_spacecraft_id ON spacecraft_subsystems(spacecraft_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_channels_spacecraft ON telemetry_channels(spacecraft_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_readings_spacecraft_time ON telemetry_readings(spacecraft_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_readings_channel_time ON telemetry_readings(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_spacecraft_state_spacecraft_time ON spacecraft_state(spacecraft_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orbital_state_spacecraft_time ON orbital_state(spacecraft_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trajectory_points_mission_time ON trajectory_points(mission_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_mission_events_mission_severity ON mission_events(mission_id, severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_mission_severity ON anomalies(mission_id, severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_mission_status ON recommendations(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_mission ON simulation_runs(mission_id, start_time DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spacecraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE spacecraft_subsystems ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE spacecraft_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbital_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE trajectory_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_stations ENABLE ROW LEVEL SECURITY;

-- Public/Authenticated read policies
CREATE POLICY "Allow public read access on missions" ON missions FOR SELECT USING (true);
CREATE POLICY "Allow public read access on spacecraft" ON spacecraft FOR SELECT USING (true);
CREATE POLICY "Allow public read access on spacecraft_subsystems" ON spacecraft_subsystems FOR SELECT USING (true);
CREATE POLICY "Allow public read access on telemetry_channels" ON telemetry_channels FOR SELECT USING (true);
CREATE POLICY "Allow public read access on telemetry_readings" ON telemetry_readings FOR SELECT USING (true);
CREATE POLICY "Allow public read access on spacecraft_state" ON spacecraft_state FOR SELECT USING (true);
CREATE POLICY "Allow public read access on orbital_state" ON orbital_state FOR SELECT USING (true);
CREATE POLICY "Allow public read access on trajectory_points" ON trajectory_points FOR SELECT USING (true);
CREATE POLICY "Allow public read access on mission_events" ON mission_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access on anomalies" ON anomalies FOR SELECT USING (true);
CREATE POLICY "Allow public read access on anomaly_predictions" ON anomaly_predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read access on recommendations" ON recommendations FOR SELECT USING (true);
CREATE POLICY "Allow public read access on simulation_runs" ON simulation_runs FOR SELECT USING (true);
CREATE POLICY "Allow public read access on ground_stations" ON ground_stations FOR SELECT USING (true);

-- Authenticated write policies (or service role)
CREATE POLICY "Allow authenticated insert on telemetry_readings" ON telemetry_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on spacecraft_state" ON spacecraft_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on orbital_state" ON orbital_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on mission_events" ON mission_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on anomalies" ON anomalies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on recommendations" ON recommendations FOR INSERT WITH CHECK (true);
