-- ============================================================================
-- VYOM: Intelligent Digital Space Mission Twin & Autonomous Mission Control
-- Phase 1: Supabase Seed Data for Four Core Mission Profiles
-- ============================================================================

-- 1. Insert Ground Stations
INSERT INTO ground_stations (id, name, latitude, longitude, elevation_m, min_elevation_deg, comm_band, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111101', 'ISTRAC Ground Station Bangalore', 13.0333, 77.5167, 920.0, 5.0, 'S/X-Band', true),
    ('11111111-1111-1111-1111-111111111102', 'Deep Space Network Goldstone', 35.4267, -116.8900, 1030.0, 5.0, 'S/X/Ka-Band', true),
    ('11111111-1111-1111-1111-111111111103', 'Deep Space Network Madrid', 40.4314, -4.2480, 780.0, 5.0, 'S/X/Ka-Band', true),
    ('11111111-1111-1111-1111-111111111104', 'Deep Space Network Canberra', -35.4014, 148.9817, 650.0, 5.0, 'S/X/Ka-Band', true),
    ('11111111-1111-1111-1111-111111111105', 'Svalbard Satellite Station (SvalSat)', 78.2297, 15.4078, 450.0, 3.0, 'S/X/Ka-Band', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Missions (4 Core Profiles)
INSERT INTO missions (id, name, mission_type, description, status, start_time, target, budget_crore, launch_site, configuration)
VALUES
    -- Mission 1: Human Exploration
    (
        'a1111111-1111-1111-1111-111111111111',
        'Gaganyaan-H1 Crewed Expedition',
        'human_exploration',
        'Crewed orbital expedition focused on human life support, autonomous navigation, and biosensing in low Earth orbit.',
        'active',
        NOW() - INTERVAL '2 days',
        'earth-orbit',
        10500.00,
        '{"name": "Satish Dhawan Space Centre (SLP)", "country": "India", "lat": 13.72, "lng": 80.23, "agency": "ISRO"}'::jsonb,
        '{"crew_size": 3, "orbit_altitude_km": 400.0, "inclination_deg": 51.6, "duration_days": 7}'::jsonb
    ),
    -- Mission 2: Orbital Observation
    (
        'a2222222-2222-2222-2222-222222222222',
        'CartoSat-3D Earth Observation',
        'orbital_observation',
        'High-resolution hyperspectral and optical imaging satellite in sun-synchronous polar orbit with real-time ground swath mapping.',
        'active',
        NOW() - INTERVAL '15 days',
        'earth-orbit',
        3500.00,
        '{"name": "Satish Dhawan Space Centre (FLP)", "country": "India", "lat": 13.72, "lng": 80.23, "agency": "ISRO"}'::jsonb,
        '{"sensor_type": "Hyperspectral Optical + SAR", "orbit_altitude_km": 505.0, "inclination_deg": 97.4, "resolution_m": 0.25}'::jsonb
    ),
    -- Mission 3: Planetary Probe
    (
        'a3333333-3333-3333-3333-333333333333',
        'Chandrayaan-4 Lunar Sample Return',
        'planetary_probe',
        'Interplanetary robotic probe on trans-lunar injection trajectory for lunar south pole exploration and automated docking.',
        'active',
        NOW() - INTERVAL '3 days',
        'lunar-surface',
        6150.00,
        '{"name": "Satish Dhawan Space Centre (SLP)", "country": "India", "lat": 13.72, "lng": 80.23, "agency": "ISRO"}'::jsonb,
        '{"target_body": "Moon", "transfer_type": "Trans-Lunar Injection (TLI)", "distance_km": 384400.0, "comm_delay_s": 1.28}'::jsonb
    ),
    -- Mission 4: Astrophysics Observatory
    (
        'a4444444-4444-4444-4444-444444444444',
        'AstroSat-II Space Telescope',
        'astrophysics_observatory',
        'Multi-wavelength space-based astronomical observatory studying active galactic nuclei, exoplanet atmospheres, and stellar flares.',
        'active',
        NOW() - INTERVAL '45 days',
        'lagrange-l1',
        4200.00,
        '{"name": "Guiana Space Centre (ELA-4)", "country": "French Guiana", "lat": 5.24, "lng": -52.77, "agency": "ESA"}'::jsonb,
        '{"observation_target": "Crab Nebula (NGC 1952)", "orbit_type": "Sun-Earth L1 Halo Orbit", "primary_aperture_m": 2.4, "cryo_temp_k": 45.0}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Spacecraft for each mission
INSERT INTO spacecraft (id, mission_id, name, mass_kg, dimensions, status)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'VYOM-Crew Capsule H1', 5300.0, '{"length_m": 7.0, "diameter_m": 3.7}'::jsonb, 'nominal'),
    ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'CartoSat-3D Bus', 1650.0, '{"length_m": 4.2, "wingspan_m": 8.5}'::jsonb, 'nominal'),
    ('b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'Ch-4 Orbiter & Lander Probe', 3900.0, '{"length_m": 5.1, "dish_diameter_m": 2.5}'::jsonb, 'nominal'),
    ('b4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 'AstroSat-II Space Observatory', 2800.0, '{"length_m": 9.4, "diameter_m": 3.0}'::jsonb, 'nominal')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Subsystems for Mission 1 (Human Exploration)
INSERT INTO spacecraft_subsystems (id, spacecraft_id, name, type, status, health_score)
VALUES
    ('c1111111-1111-1111-1111-111111111101', 'b1111111-1111-1111-1111-111111111111', 'Electrical Power System (EPS)', 'power', 'nominal', 98.5),
    ('c1111111-1111-1111-1111-111111111102', 'Thermal Control System (TCS)', 'thermal', 'nominal', 96.0),
    ('c1111111-1111-1111-1111-111111111103', 'Attitude Determination & Control (ADCS)', 'adcs', 'nominal', 99.2),
    ('c1111111-1111-1111-1111-111111111104', 'Environmental Control & Life Support (ECLSS)', 'life_support', 'nominal', 97.8),
    ('c1111111-1111-1111-1111-111111111105', 'RF Communication & Telemetry', 'communication', 'nominal', 99.5),
    ('c1111111-1111-1111-1111-111111111106', 'Reaction Control Propulsion (RCS)', 'propulsion', 'nominal', 98.0),
    ('c1111111-1111-1111-1111-111111111107', 'Flight Avionics & C&DH', 'avionics', 'nominal', 100.0)
ON CONFLICT (id) DO NOTHING;
