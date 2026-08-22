import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMissionStore } from "../../store/missionStore";

// ─── Subsystem Node Interface ────────────────────────────────────────────────
interface SubsystemNode {
  id: string;
  name: string;
  code: string;
  group: "power" | "avionics" | "adcs" | "comms" | "thermal" | "propulsion" | "eclss" | "payload";
  x: number;
  y: number;
  icon: string;
  connections: string[];
  specs: {
    voltage?: string;
    power?: string;
    temp?: string;
    redundancy: string;
    mass: string;
    bus: string;
    description: string;
  };
}

// ─── Architecture Presets ────────────────────────────────────────────────────
interface ArchitecturePreset {
  id: string;
  name: string;
  category: "Human Spacecraft" | "Orbital Satellite" | "Deep Space Probe" | "Telecom Relay" | "Planetary Lander";
  destination: string;
  dryMassKg: number;
  totalPowerW: number;
  description: string;
  missionType: "human" | "robotic" | "comms";
}

const ARCH_PRESETS: ArchitecturePreset[] = [
  {
    id: "vyom-human-orbital",
    name: "VYOM Crewed Orbital Module",
    category: "Human Spacecraft",
    destination: "Low Earth Orbit (400 km)",
    dryMassKg: 5200,
    totalPowerW: 8500,
    description: "Fully redundant crewed vehicle with active ECLSS, dual fault-tolerant flight computers, and dual solar arrays.",
    missionType: "human",
  },
  {
    id: "isro-lunar-lander",
    name: "Lunar Descent & Ascent Lander",
    category: "Planetary Lander",
    destination: "Lunar South Pole",
    dryMassKg: 1850,
    totalPowerW: 3200,
    description: "High-thrust bipropellant propulsion with autonomous hazard detection, laser altimetry, and rover deployment bus.",
    missionType: "robotic",
  },
  {
    id: "geo-broadband-relay",
    name: "GEO Heavy Telecommunications Relay",
    category: "Telecom Relay",
    destination: "Geostationary Orbit (35,786 km)",
    dryMassKg: 4200,
    totalPowerW: 14500,
    description: "High-capacity multi-beam Ka/Ku-band transponder suite with electric ion propulsion for station keeping.",
    missionType: "comms",
  },
  {
    id: "deepspace-heliosphere",
    name: "Deep Space Heliospheric Explorer",
    category: "Deep Space Probe",
    destination: "Interplanetary Outer Solar System",
    dryMassKg: 950,
    totalPowerW: 650,
    description: "Radioisotope Thermoelectric Generator (RTG) powered probe with 2.8m High-Gain Antenna and planetary magnetometry.",
    missionType: "robotic",
  },
  {
    id: "earth-obs-sar",
    name: "Earth Observation SAR Constellation",
    category: "Orbital Satellite",
    destination: "Sun-Synchronous LEO (620 km)",
    dryMassKg: 1400,
    totalPowerW: 4200,
    description: "X-band Synthetic Aperture Radar satellite with high-speed X-band downlink and precision magnetic torquers.",
    missionType: "robotic",
  },
];

const GROUP_COLORS: Record<string, { primary: string; glow: string; label: string }> = {
  power: { primary: "#ff9500", glow: "rgba(255,149,0,0.4)", label: "POWER & EPS" },
  avionics: { primary: "#00ff88", glow: "rgba(0,255,136,0.4)", label: "AVIONICS & C&DH" },
  adcs: { primary: "#00d4ff", glow: "rgba(0,212,255,0.4)", label: "GNC & ATTITUDE" },
  comms: { primary: "#9b5de5", glow: "rgba(155,93,229,0.4)", label: "TELECOMMUNICATIONS" },
  thermal: { primary: "#ff6b35", glow: "rgba(255,107,53,0.4)", label: "THERMAL CONTROL" },
  propulsion: { primary: "#ff2d55", glow: "rgba(255,45,85,0.4)", label: "PROPULSION & RCS" },
  eclss: { primary: "#00ffcc", glow: "rgba(0,255,204,0.4)", label: "CREW & ECLSS" },
  payload: { primary: "#00aaff", glow: "rgba(0,170,255,0.4)", label: "MISSION PAYLOADS" },
};

function getArchitectureNodes(preset: ArchitecturePreset): SubsystemNode[] {
  const isHuman = preset.missionType === "human";
  const isComms = preset.missionType === "comms";

  const nodes: SubsystemNode[] = [
    // ─── 1. POWER SUBSYSTEM (Left Column) ──────────────────────────────────
    {
      id: "solar",
      name: "Gallium Arsenide Solar Arrays",
      code: "PV-ARRAY",
      group: "power",
      x: 70,
      y: 100,
      icon: "⚡",
      connections: ["eps", "shunt"],
      specs: {
        voltage: "28.0 - 32.5 VDC",
        power: "12,000 W (BOL)",
        temp: "-80°C to +110°C",
        redundancy: "Dual Isolated Wings (A+B)",
        mass: "145 kg",
        bus: "Main Power Bus 28V",
        description: "Deployable triple-junction GaAs solar array wings with solar tracking drive actuators (SADA).",
      },
    },
    {
      id: "shunt",
      name: "Sequential Shunt Limiter",
      code: "S3R-PDU",
      group: "power",
      x: 70,
      y: 240,
      icon: "🎛️",
      connections: ["eps"],
      specs: {
        voltage: "28.0 VDC Regulated",
        power: "14,000 W Capacity",
        temp: "+24.5°C",
        redundancy: "Quad Parallel Shunts",
        mass: "18.2 kg",
        bus: "Regulated Main Bus",
        description: "Dissipates excess solar panel power and prevents voltage spikes into the spacecraft battery banks.",
      },
    },
    {
      id: "battery",
      name: "Lithium-Ion Battery Storage",
      code: "BAT-8K4",
      group: "power",
      x: 70,
      y: 380,
      icon: "🔋",
      connections: ["eps"],
      specs: {
        voltage: "28.6 VDC Nominal",
        power: "8,400 Wh Capacity",
        temp: "+18.2°C (Controlled)",
        redundancy: "Dual Battery Modules",
        mass: "88.5 kg",
        bus: "Battery Charge/Discharge Bus",
        description: "Primary rechargeable energy storage providing continuous spacecraft power during orbital eclipse phases.",
      },
    },
    {
      id: "eps",
      name: "Electrical Power System (PDU)",
      code: "EPS-DIST",
      group: "power",
      x: 240,
      y: 240,
      icon: "⚡",
      connections: ["obc", "comms", "thermal", "gnc", "prop_ctrl", ...(isHuman ? ["eclss"] : ["payload"])],
      specs: {
        voltage: "28V / 50V / 5V Regulated",
        power: "10,500 W Peak",
        temp: "+32.0°C",
        redundancy: "Cross-Strapped Dual PDUs",
        mass: "34.0 kg",
        bus: "Power Distribution Network",
        description: "Central solid-state power distribution unit routing current limiters, circuit protection, and telemetry relays.",
      },
    },

    // ─── 2. AVIONICS & C&DH (Center-Left Column) ────────────────────────────
    {
      id: "obc",
      name: "Dual Fault-Tolerant Flight Computer",
      code: "OBC-RAD750",
      group: "avionics",
      x: 430,
      y: 100,
      icon: "💻",
      connections: ["ssmr", "blackbox", "gnc", "comms", "prop_ctrl", ...(isHuman ? ["eclss"] : ["payload"])],
      specs: {
        voltage: "5.0 VDC / 3.3 VDC",
        power: "42 W",
        temp: "+41.8°C",
        redundancy: "Dual Lockstep RAD750 Processors",
        mass: "14.2 kg",
        bus: "SpaceWire / MIL-STD-1553B",
        description: "Primary on-board computer executing flight software, autonomous fault management (FDIR), and orbit commands.",
      },
    },
    {
      id: "ssmr",
      name: "Solid State Mass Memory Recorder",
      code: "SSMR-512G",
      group: "avionics",
      x: 430,
      y: 240,
      icon: "💾",
      connections: ["comms"],
      specs: {
        voltage: "5.0 VDC",
        power: "18 W",
        temp: "+28.4°C",
        redundancy: "Triple Modular Redundancy (TMR)",
        mass: "6.8 kg",
        bus: "SpaceWire High-Speed Bus",
        description: "Radiation-hardened solid-state storage buffer storing science payload imagery, telemetry logs, and trajectory data.",
      },
    },
    {
      id: "blackbox",
      name: "Radiation-Hardened Black Box",
      code: "BLKBX-700",
      group: "avionics",
      x: 430,
      y: 380,
      icon: "📼",
      connections: [],
      specs: {
        voltage: "28.0 VDC Isolated",
        power: "8.5 W",
        temp: "+22.0°C",
        redundancy: "Armored Solid-State Core",
        mass: "11.5 kg",
        bus: "CAN Bus High-Integrity Channel",
        description: "Non-volatile crash-survivable telemetry event recorder logging critical system anomalies and state vectors.",
      },
    },

    // ─── 3. GNC & ATTITUDE CONTROL (Top Center) ─────────────────────────────
    {
      id: "gnc",
      name: "Attitude Determination & Control (ADCS)",
      code: "GNC-ADCS",
      group: "adcs",
      x: 630,
      y: 100,
      icon: "🎯",
      connections: ["startracker", "imu", "wheels", "torquers", "rcs"],
      specs: {
        voltage: "28.0 VDC",
        power: "35 W",
        temp: "+34.5°C",
        redundancy: "Cross-Strapped Kalman Filter",
        mass: "9.4 kg",
        bus: "MIL-STD-1553B",
        description: "Computes real-time spacecraft attitude quaternion, pointing vectors, and reaction wheel torque commands.",
      },
    },
    {
      id: "startracker",
      name: "Autonomous Star Trackers",
      code: "STR-OPTIC",
      group: "adcs",
      x: 820,
      y: 50,
      icon: "⭐",
      connections: [],
      specs: {
        voltage: "28.0 VDC",
        power: "12 W",
        temp: "+15.0°C",
        redundancy: "Dual Optical Optical Heads",
        mass: "4.2 kg",
        bus: "RS-422 Pointing Interface",
        description: "High-precision autonomous star catalog pattern recognition sensor delivering sub-arcsecond attitude accuracy.",
      },
    },
    {
      id: "imu",
      name: "Inertial Measurement Unit (IMU)",
      code: "IMU-FOG",
      group: "adcs",
      x: 820,
      y: 150,
      icon: "🧭",
      connections: [],
      specs: {
        voltage: "28.0 VDC",
        power: "16 W",
        temp: "+26.0°C",
        redundancy: "Tri-Axial Fiber Optic Gyros",
        mass: "5.1 kg",
        bus: "1553B Attitude Channel",
        description: "Provides continuous high-rate angular velocity and linear acceleration rate sensing during dynamic maneuvers.",
      },
    },
    {
      id: "wheels",
      name: "Tetrahedral Reaction Wheel Array",
      code: "RWA-4X",
      group: "adcs",
      x: 630,
      y: 240,
      icon: "⚙️",
      connections: [],
      specs: {
        voltage: "28.0 VDC",
        power: "110 W (Maneuver)",
        temp: "+38.2°C",
        redundancy: "4-Wheel Tetrahedral (1 Redundant)",
        mass: "24.0 kg",
        bus: "PWM Motor Drive Bus",
        description: "Momentum exchange flywheel array for high-precision spacecraft 3-axis attitude slewing and jitter control.",
      },
    },
    {
      id: "torquers",
      name: "Magnetic Torquer Rods",
      code: "MTQ-3AX",
      group: "adcs",
      x: 820,
      y: 240,
      icon: "🧲",
      connections: [],
      specs: {
        voltage: "28.0 VDC",
        power: "14 W",
        temp: "+21.0°C",
        redundancy: "Dual Coil Windings",
        mass: "7.8 kg",
        bus: "Current Driver Interface",
        description: "Interacts with planetary magnetic field to desaturate reaction wheels without consuming chemical propellant.",
      },
    },

    // ─── 4. TELECOMMUNICATIONS (Bottom Center) ──────────────────────────────
    {
      id: "comms",
      name: "S/X-Band Communications Transceiver",
      code: "COMM-TRX",
      group: "comms",
      x: 430,
      y: 520,
      icon: "📡",
      connections: ["hga", "patch"],
      specs: {
        voltage: "28.0 VDC",
        power: "85 W (Tx)",
        temp: "+28.0°C",
        redundancy: "Dual Redundant Transponders (A+B)",
        mass: "12.8 kg",
        bus: "RF Feed / 1553B Command",
        description: "Full-duplex command uplink and high-rate telemetry downlink transceiver with automated frequency tracking.",
      },
    },
    {
      id: "hga",
      name: "High-Gain Parabolic Reflector (HGA)",
      code: "HGA-2M4",
      group: "comms",
      x: 630,
      y: 520,
      icon: "🛰️",
      connections: [],
      specs: {
        voltage: "28.0 VDC (Gimbal)",
        power: "22 W",
        temp: "-120°C to +80°C",
        redundancy: "Dual-Axis Steerable Gimbal",
        mass: "28.5 kg",
        bus: "Waveguide Link",
        description: "2.4m dual-gimbal steerable high-gain parabolic reflector antenna for deep-space broadband communication.",
      },
    },
    {
      id: "patch",
      name: "Omnidirectional Patch Antennas",
      code: "OMNI-PATCH",
      group: "comms",
      x: 240,
      y: 520,
      icon: "📻",
      connections: [],
      specs: {
        voltage: "Passive",
        power: "0 W",
        temp: "-90°C to +90°C",
        redundancy: "Bilateral Hemispheric Antennas",
        mass: "2.4 kg",
        bus: "Coaxial Feedline",
        description: "Provides spherical 4-pi steradian emergency command coverage during tumbling or safe mode recovery.",
      },
    },

    // ─── 5. THERMAL CONTROL (Center Right) ──────────────────────────────────
    {
      id: "thermal",
      name: "Active Fluid Loop Thermal Controller",
      code: "TCS-FLUID",
      group: "thermal",
      x: 240,
      y: 380,
      icon: "🌡️",
      connections: ["radiator", "heaters"],
      specs: {
        voltage: "28.0 VDC",
        power: "48 W",
        temp: "+22.5°C",
        redundancy: "Dual Redundant Pump Loops",
        mass: "22.0 kg",
        bus: "Fluid Loop 1553B Interface",
        description: "Maintains optimal internal component temperatures using single-phase fluid loops and bypass mixing valves.",
      },
    },
    {
      id: "radiator",
      name: "Thermal Radiator Panels",
      code: "RAD-PANEL",
      group: "thermal",
      x: 70,
      y: 520,
      icon: "♨️",
      connections: [],
      specs: {
        voltage: "Passive",
        power: "0 W",
        temp: "-65.0°C",
        redundancy: "Dual Symmetrical Wings",
        mass: "38.0 kg",
        bus: "Heat Pipe Thermal Bus",
        description: "Optical solar reflector (OSR) coated radiator panels rejecting internal heat into deep-space blackbody sink.",
      },
    },
    {
      id: "heaters",
      name: "PTC Survival Heating Elements",
      code: "HTR-PTC",
      group: "thermal",
      x: 240,
      y: 100,
      icon: "🔥",
      connections: [],
      specs: {
        voltage: "28.0 VDC",
        power: "140 W (Eclipse)",
        temp: "+20.0°C Target",
        redundancy: "Dual Circuit Heaters",
        mass: "4.5 kg",
        bus: "Thermostat Control Lines",
        description: "Survival heaters preventing hydrazine line freezing and battery sub-zero chilling during prolonged eclipses.",
      },
    },

    // ─── 6. PROPULSION (Right Column) ───────────────────────────────────────
    {
      id: "prop_ctrl",
      name: "Propulsion Valve & Thruster Driver",
      code: "PSU-CTRL",
      group: "propulsion",
      x: 820,
      y: 380,
      icon: "🚀",
      connections: ["mainengine", "rcs", "tanks"],
      specs: {
        voltage: "28.0 VDC",
        power: "65 W (Firing)",
        temp: "+24.0°C",
        redundancy: "Dual Valve Driver Banks",
        mass: "8.2 kg",
        bus: "High-Current Actuator Bus",
        description: "Commands propellant latch valves, thruster solenoid pulses, and tank helium pressurization regulators.",
      },
    },
    {
      id: "mainengine",
      name: "450N Bipropellant Main Engine",
      code: "LAM-450N",
      group: "propulsion",
      x: 1010,
      y: 300,
      icon: "🔥",
      connections: [],
      specs: {
        voltage: "28.0 VDC Valves",
        power: "450 N Thrust",
        temp: "+1450°C (Chamber)",
        redundancy: "Dual Series Latch Valves",
        mass: "16.4 kg",
        bus: "MMH / NTO Hypergolic",
        description: "Primary delta-V engine for orbital insertion, apogee raising, and trans-lunar trajectory correction burns.",
      },
    },
    {
      id: "rcs",
      name: "16-Cluster Reaction Control (RCS)",
      code: "RCS-16X",
      group: "propulsion",
      x: 1010,
      y: 440,
      icon: "💨",
      connections: [],
      specs: {
        voltage: "28.0 VDC Solenoids",
        power: "10 N Thrust / Jet",
        temp: "+35.0°C",
        redundancy: "Dual Pods (8+8 Thrusters)",
        mass: "12.0 kg",
        bus: "Hydrazine Monopropellant",
        description: "High-frequency pulsed reaction control thruster pods for rapid attitude slew, wheel unloading, and docking.",
      },
    },
    {
      id: "tanks",
      name: "Helium-Pressurized Propellant Tanks",
      code: "TANK-COPV",
      group: "propulsion",
      x: 1010,
      y: 160,
      icon: "⛽",
      connections: [],
      specs: {
        voltage: "Passive Pressure",
        power: "310 Bar Pressure",
        temp: "+22.0°C",
        redundancy: "Titanium Diaphragm COPV",
        mass: "42.0 kg (Dry)",
        bus: "Propellant Manifold",
        description: "Carbon-overwrapped pressure vessels storing fuel and oxidizer under regulated high-pressure gaseous helium.",
      },
    },
  ];

  // If human spacecraft, inject ECLSS Habitat nodes
  if (isHuman) {
    nodes.push(
      {
        id: "eclss",
        name: "ECLSS Atmosphere Pressure & Gas Reg",
        code: "ECLSS-O2N2",
        group: "eclss",
        x: 630,
        y: 380,
        icon: "🌬️",
        connections: ["co2scrub", "water_rec"],
        specs: {
          voltage: "28.0 VDC",
          power: "380 W",
          temp: "+21.5°C",
          redundancy: "Dual Regulators (101.3 kPa)",
          mass: "92.0 kg",
          bus: "ECLSS Avionics 1553B",
          description: "Monitors cabin oxygen partial pressure (PO2 21 kPa), nitrogen replenishment, and cabin pressure relief.",
        },
      },
      {
        id: "co2scrub",
        name: "CDRA Carbon Dioxide Removal Assembly",
        code: "CO2-CDRA",
        group: "eclss",
        x: 820,
        y: 520,
        icon: "🛡️",
        connections: [],
        specs: {
          voltage: "28.0 VDC",
          power: "420 W",
          temp: "+65.0°C (Desorption)",
          redundancy: "Dual Molecular Sieve Beds",
          mass: "46.0 kg",
          bus: "Regenerative Air Loop",
          description: "Continuously adsorbs metabolic CO2 and trace contaminants to maintain safe air envelope (<400 ppm).",
        },
      },
      {
        id: "water_rec",
        name: "Water Processor & Recovery Loop",
        code: "WPA-DIST",
        group: "eclss",
        x: 1010,
        y: 560,
        icon: "💧",
        connections: [],
        specs: {
          voltage: "28.0 VDC",
          power: "240 W",
          temp: "+24.0°C",
          redundancy: "Catalytic Oxidation Loop",
          mass: "58.0 kg",
          bus: "Potable Fluid Manifold",
          description: "Recovers 93% of humidity condensate and wastewater into purified potable drinking and food hydration reserves.",
        },
      }
    );
  } else {
    // Robotic Science Payload nodes
    nodes.push(
      {
        id: "payload",
        name: isComms ? "Broadband Ka/Ku Multi-Beam Transponder" : "High-Resolution Multispectral Optical Imager",
        code: isComms ? "PL-KABAND" : "PL-HR-OPTIC",
        group: "payload",
        x: 630,
        y: 380,
        icon: isComms ? "📡" : "🔬",
        connections: [],
        specs: {
          voltage: "28.0 VDC / 50 VDC",
          power: isComms ? "2,400 W" : "180 W",
          temp: "+18.0°C",
          redundancy: "Dual Focal Planes / Channels",
          mass: isComms ? "110 kg" : "64 kg",
          bus: "High-Rate SpaceWire (400 Mbps)",
          description: isComms
            ? "Multi-channel high-power traveling wave tube amplifier transponder suite for commercial broadband relay."
            : "0.5m aperture multispectral optical telescope with TDI sensor array for sub-meter planetary surface mapping.",
        },
      }
    );
  }

  return nodes;
}

export const ArchitectureSelectionScreen: React.FC = () => {
  const satellite = useMissionStore((s) => s.satellite);
  const telemetry = useMissionStore((s) => s.telemetry);
  const activeThreats = useMissionStore((s) => s.activeThreats);

  const [selectedArch, setSelectedArch] = useState<ArchitecturePreset>(ARCH_PRESETS[0]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("obc");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("all");
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const SVG_WIDTH = 1180;
  const SVG_HEIGHT = 680;

  const handleZoomIn = () => setZoom((z) => Math.min(3.5, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStart.x) * (1 / zoom);
      const dy = (e.clientY - dragStart.y) * (1 / zoom);
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Dynamic ViewBox Calculation for instantaneous vector zoom & pan
  const vbWidth = SVG_WIDTH / zoom;
  const vbHeight = SVG_HEIGHT / zoom;
  const vbX = (SVG_WIDTH - vbWidth) / 2 - pan.x;
  const vbY = (SVG_HEIGHT - vbHeight) / 2 - pan.y;

  const focusOnNode = (node: SubsystemNode) => {
    setSelectedNodeId(node.id);
    setZoom(1.8);
    // Center viewBox on this node
    setPan({
      x: (SVG_WIDTH / 2) - (node.x + 65),
      y: (SVG_HEIGHT / 2) - (node.y + 35),
    });
  };

  const nodes = useMemo(() => getArchitectureNodes(selectedArch), [selectedArch]);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || nodes[0], [nodes, selectedNodeId]);

  // Compute live health and status based on real mission store telemetry
  const getNodeHealth = (nodeId: string): number => {
    if (!satellite?.subsystems) return 100;
    const sub = satellite.subsystems.find(
      (s) => s.name.toLowerCase().includes(nodeId) || nodeId.includes(s.name.toLowerCase().split(" ")[0])
    );
    if (sub) return sub.health;
    if (nodeId === "battery" && telemetry) return telemetry.power.batteryPercent;
    if (nodeId === "solar" && telemetry) return Math.min(100, (telemetry.power.solarGenerationW / 300) * 100);
    if (nodeId === "obc" && telemetry) return 100 - telemetry.compute.cpuPercent * 0.25;
    if (nodeId === "comms" && telemetry) return telemetry.comm.uptime;
    if (nodeId === "thermal" && telemetry) return telemetry.thermal.cpuTempC < 65 ? 100 : telemetry.thermal.cpuTempC < 80 ? 70 : 35;
    return 100;
  };

  const getNodeStatus = (nodeId: string): "nominal" | "warning" | "failed" => {
    const threatened = activeThreats.some((t) => {
      const typ = (t.type ?? "").toLowerCase();
      return (
        (nodeId.includes("power") || nodeId === "battery" || nodeId === "solar" || nodeId === "eps") && typ.includes("power") ||
        (nodeId === "comms" || nodeId === "hga") && typ.includes("comm") ||
        nodeId === "thermal" && typ.includes("thermal") ||
        (nodeId === "obc" || nodeId === "gnc") && typ.includes("radiation") ||
        typ.includes(nodeId)
      );
    });
    if (threatened) return "failed";
    const h = getNodeHealth(nodeId);
    if (h >= 75) return "nominal";
    if (h >= 45) return "warning";
    return "failed";
  };

  const getNodeColor = (node: SubsystemNode): string => {
    const st = getNodeStatus(node.id);
    if (st === "failed") return "#ff2d55";
    if (st === "warning") return "#ff9500";
    return GROUP_COLORS[node.group]?.primary ?? "#00d4ff";
  };


  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "radial-gradient(ellipse at 50% 30%, #031424 0%, #010712 65%, #000308 100%)",
        paddingBottom: 56,
        overflow: "hidden",
      }}
    >
      {/* Top Header Command Bar */}
      <div
        style={{
          padding: "14px 24px",
          borderBottom: "1px solid rgba(0,240,255,0.18)",
          background: "rgba(2,8,18,0.95)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ffcc", boxShadow: "0 0 10px #00ffcc" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 900, color: "#00f0ff", letterSpacing: "0.12em" }}>
              SPACECRAFT ARCHITECTURE &amp; SUBSYSTEM TOPOLOGY
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
            COMPLETE SYSTEM BUS DIAGRAM · ACTIVE TELEMETRY INTEGRATION · FAULT MANAGEMENT (FDIR)
          </div>
        </div>

        {/* Global Summary Metric Badges */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {[
            { label: "PRESET", value: selectedArch.name.toUpperCase(), color: "#00f0ff" },
            { label: "DRY MASS", value: `${selectedArch.dryMassKg.toLocaleString()} kg`, color: "#00ffcc" },
            { label: "POWER BUS", value: `${selectedArch.totalPowerW.toLocaleString()} W`, color: "#ff9500" },
            { label: "SUBSYSTEMS", value: `${nodes.length} UNITS`, color: "#9b5de5" },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                background: "rgba(0,18,34,0.85)",
                border: `1px solid ${b.color}44`,
                borderRadius: 4,
                padding: "4px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>{b.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: b.color }}>{b.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 340px", overflow: "hidden" }}>
        {/* ─── LEFT COLUMN: ARCHITECTURE SELECTOR & HEALTH ROSTER ─── */}
        <div
          style={{
            borderRight: "1px solid rgba(0,240,255,0.12)",
            background: "rgba(2,8,18,0.75)",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            overflowY: "auto",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "#00f0ff", letterSpacing: "0.15em", marginBottom: 8, fontWeight: 700 }}>
              SELECT VEHICLE CONFIGURATION
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ARCH_PRESETS.map((arch) => {
                const isSelected = selectedArch.id === arch.id;
                return (
                  <motion.div
                    key={arch.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setSelectedArch(arch);
                      setSelectedNodeId("obc");
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: isSelected ? "rgba(0,240,255,0.15)" : "rgba(0,18,34,0.5)",
                      border: `1px solid ${isSelected ? "#00f0ff" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: isSelected ? "0 0 14px rgba(0,240,255,0.2)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 11.5, fontWeight: 700, color: isSelected ? "#00f0ff" : "#fff" }}>
                        {arch.name}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: isSelected ? "#00ffcc" : "rgba(255,255,255,0.4)" }}>
                        {arch.category}
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.35, marginBottom: 6 }}>
                      {arch.description}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>
                      <span>DEST: {arch.destination}</span>
                      <span style={{ color: "#ff9500" }}>{arch.totalPowerW} W</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Subsystem Health Roster */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "#00f0ff", letterSpacing: "0.15em", marginBottom: 8, fontWeight: 700 }}>
              LIVE SUBSYSTEM HEALTH ({nodes.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {nodes.map((node) => {
                const health = getNodeHealth(node.id);
                const status = getNodeStatus(node.id);
                const col = status === "failed" ? "#ff2d55" : status === "warning" ? "#ff9500" : "#00ffcc";
                const isSelected = selectedNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: isSelected ? "rgba(0,240,255,0.18)" : "rgba(0,14,26,0.5)",
                      border: `1px solid ${isSelected ? "#00f0ff" : "rgba(255,255,255,0.05)"}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9 }}>{node.icon}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: isSelected ? "#fff" : "rgba(255,255,255,0.7)" }}>
                        {node.code}
                      </span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: col }}>
                      {health.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── CENTER COLUMN: FULL-BLEED SVG ARCHITECTURE CANVAS ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {/* Subsystem Filter & Canvas Control Toolbar */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(2,8,18,0.85)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Layer Filter Buttons */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button
                onClick={() => setActiveGroupFilter("all")}
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: `1px solid ${activeGroupFilter === "all" ? "#00f0ff" : "rgba(255,255,255,0.1)"}`,
                  background: activeGroupFilter === "all" ? "rgba(0,240,255,0.25)" : "rgba(0,0,0,0.3)",
                  color: activeGroupFilter === "all" ? "#fff" : "rgba(255,255,255,0.5)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 7.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                SHOW ALL BUSES
              </button>
              {Object.entries(GROUP_COLORS).map(([grp, meta]) => {
                const isActive = activeGroupFilter === grp;
                return (
                  <button
                    key={grp}
                    onClick={() => setActiveGroupFilter(isActive ? "all" : grp)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: `1px solid ${isActive ? meta.primary : "rgba(255,255,255,0.08)"}`,
                      background: isActive ? `${meta.primary}33` : "rgba(0,0,0,0.25)",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 7.5,
                      cursor: "pointer",
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Zoom In / Zoom Out Controls & Presets */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,18,34,0.7)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(0,240,255,0.25)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#00f0ff", fontWeight: 700, letterSpacing: "0.08em" }}>
                🔍 ZOOM:
              </span>

              {/* Zoom Out Button */}
              <button
                onClick={handleZoomOut}
                title="Zoom Out (−)"
                style={{
                  padding: "3px 8px",
                  background: "rgba(0,240,255,0.15)",
                  border: "1px solid rgba(0,240,255,0.35)",
                  borderRadius: 4,
                  color: "#00f0ff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                −
              </button>

              {/* Interactive Zoom Slider */}
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{
                  width: 70,
                  height: 4,
                  accentColor: "#00f0ff",
                  cursor: "pointer",
                }}
              />

              {/* Zoom In Button */}
              <button
                onClick={handleZoomIn}
                title="Zoom In (+)"
                style={{
                  padding: "3px 8px",
                  background: "rgba(0,240,255,0.25)",
                  border: "1px solid #00f0ff",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 0 8px rgba(0,240,255,0.3)",
                }}
              >
                + ZOOM IN
              </button>

              {/* Preset Buttons */}
              {[
                { label: "50%", val: 0.5 },
                { label: "100%", val: 1.0 },
                { label: "150%", val: 1.5 },
                { label: "200%", val: 2.0 },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => setZoom(p.val)}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 3,
                    border: `1px solid ${Math.abs(zoom - p.val) < 0.05 ? "#00f0ff" : "rgba(255,255,255,0.08)"}`,
                    background: Math.abs(zoom - p.val) < 0.05 ? "rgba(0,240,255,0.3)" : "rgba(0,0,0,0.3)",
                    color: Math.abs(zoom - p.val) < 0.05 ? "#fff" : "rgba(255,255,255,0.5)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 7.5,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}

              {/* Fit / Reset */}
              <button
                onClick={handleResetZoom}
                title="Fit to Screen"
                style={{
                  padding: "2px 7px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 3,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 7.5,
                  cursor: "pointer",
                }}
              >
                FIT
              </button>

              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#00f0ff", fontWeight: 700, minWidth: 32 }}>
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {/* Full-Screen Architecture SVG Canvas with Wheel Zoom & Pan Dragging */}
          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              flex: 1,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
              cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
              padding: 12,
              userSelect: "none",
            }}
          >
            {/* Floating Zoom In/Out HUD Widget on Bottom Right */}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                right: 20,
                zIndex: 20,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "rgba(0,18,34,0.92)",
                border: "1px solid rgba(0,240,255,0.45)",
                borderRadius: 6,
                padding: 4,
                boxShadow: "0 0 20px rgba(0,240,255,0.25)",
              }}
            >
              <button
                onClick={handleZoomIn}
                title="Zoom In (+)"
                style={{
                  width: 32,
                  height: 32,
                  background: "rgba(0,240,255,0.25)",
                  border: "1px solid #00f0ff",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 8px rgba(0,240,255,0.4)",
                }}
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                title="Zoom Out (−)"
                style={{
                  width: 32,
                  height: 32,
                  background: "rgba(0,240,255,0.15)",
                  border: "1px solid rgba(0,240,255,0.35)",
                  borderRadius: 4,
                  color: "#00f0ff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                −
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset Zoom / Fit to Screen"
                style={{
                  width: 32,
                  height: 24,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 4,
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                FIT
              </button>
            </div>

            <svg
              viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
              style={{
                width: "100%",
                height: "100%",
                background: "rgba(3,14,28,0.7)",
                borderRadius: 10,
                border: "1px solid rgba(0,240,255,0.15)",
                boxShadow: "inset 0 0 60px rgba(0,240,255,0.04)",
              }}
            >
              <defs>
                <filter id="glow-node">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
                </pattern>
                {/* Arrow markers */}
                <marker id="arrow-power" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#ff9500" />
                </marker>
                <marker id="arrow-data" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#00ff88" />
                </marker>
              </defs>

              {/* Grid Background */}
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#grid-pattern)" />

              {/* Subsystem Bus Regions / Group Dividers */}
              <g opacity={0.35}>
                <text x={70} y={40} fill="#ff9500" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing="0.15em">⚡ POWER GENERATION &amp; STORAGE</text>
                <text x={380} y={40} fill="#00ff88" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing="0.15em">💻 AVIONICS, C&amp;DH &amp; FLIGHT COMPUTE</text>
                <text x={750} y={40} fill="#00d4ff" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing="0.15em">🎯 GNC, ADCS &amp; ORBIT CONTROL</text>
                <text x={840} y={350} fill="#ff2d55" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing="0.15em">🚀 PROPULSION &amp; DELTA-V</text>
                <text x={350} y={480} fill="#9b5de5" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" letterSpacing="0.15em">📡 RF &amp; DEEP-SPACE COMMS</text>
              </g>

              {/* Inter-subsystem Connection Lines & Data Buses */}
              {nodes.map((node) =>
                node.connections.map((targetId) => {
                  const target = nodes.find((n) => n.id === targetId);
                  if (!target) return null;
                  const isPower = node.group === "power";
                  const isFiltered = activeGroupFilter !== "all" && node.group !== activeGroupFilter && target.group !== activeGroupFilter;
                  const isHovered = hoveredNodeId === node.id || hoveredNodeId === targetId;
                  const isSelected = selectedNodeId === node.id || selectedNodeId === targetId;
                  const col = isPower ? "#ff9500" : GROUP_COLORS[node.group]?.primary ?? "#00d4ff";

                  return (
                    <g key={`${node.id}-${targetId}`} opacity={isFiltered ? 0.1 : isHovered || isSelected ? 1.0 : 0.45}>
                      <line
                        x1={node.x + 65}
                        y1={node.y + 35}
                        x2={target.x + 65}
                        y2={target.y + 35}
                        stroke={col}
                        strokeWidth={isSelected || isHovered ? 2.5 : 1.2}
                        strokeDasharray={isPower ? "6,4" : "none"}
                        markerEnd={isPower ? "url(#arrow-power)" : "url(#arrow-data)"}
                      />
                    </g>
                  );
                })
              )}

              {/* Subsystem Component Nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const status = getNodeStatus(node.id);
                const health = getNodeHealth(node.id);
                const col = getNodeColor(node);
                const isFiltered = activeGroupFilter !== "all" && node.group !== activeGroupFilter;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{ cursor: "pointer" }}
                    opacity={isFiltered ? 0.2 : 1.0}
                  >
                    {/* Node Container Card */}
                    <rect
                      x={0}
                      y={0}
                      width={130}
                      height={70}
                      rx={6}
                      fill={isSelected ? "rgba(0,34,58,0.96)" : isHovered ? "rgba(0,24,44,0.92)" : "rgba(3,16,32,0.88)"}
                      stroke={isSelected ? "#00f0ff" : col}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                      filter={isSelected || status === "failed" ? "url(#glow-node)" : undefined}
                    />

                    {/* Top Group Strip */}
                    <rect x={0} y={0} width={130} height={3} fill={col} rx={1} />

                    {/* Node Header: Icon & Code */}
                    <text x={8} y={20} fontSize="14" style={{ fontFamily: "system-ui" }}>
                      {node.icon}
                    </text>
                    <text x={28} y={18} fill="#fff" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700">
                      {node.code}
                    </text>

                    {/* Health % Tag */}
                    <text x={122} y={18} fill={col} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fontWeight="700">
                      {health.toFixed(0)}%
                    </text>

                    {/* Subsystem Name Label */}
                    <text x={8} y={36} fill="rgba(255,255,255,0.85)" fontFamily="var(--font-mono)" fontSize="7.5" fontWeight="400">
                      {node.name.length > 20 ? node.name.substring(0, 19) + "…" : node.name}
                    </text>

                    {/* Primary Spec Line */}
                    <text x={8} y={48} fill={col} fontFamily="var(--font-mono)" fontSize="7" opacity="0.9">
                      {node.specs.power || node.specs.voltage || node.specs.temp || "NOMINAL"}
                    </text>

                    {/* Health Progress Bar */}
                    <rect x={8} y={56} width={114} height={4} rx={2} fill="rgba(255,255,255,0.08)" />
                    <rect x={8} y={56} width={Math.max(0, (health / 100) * 114)} height={4} rx={2} fill={col} />

                    {/* Selection Indicator Ring */}
                    {isSelected && (
                      <circle cx={122} cy={6} r={3} fill="#00f0ff" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: DETAILED NODE INSPECTOR & SPECS ─── */}
        <div
          style={{
            borderLeft: "1px solid rgba(0,240,255,0.12)",
            background: "rgba(2,8,18,0.85)",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflowY: "auto",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "#00f0ff", letterSpacing: "0.15em", fontWeight: 700 }}>
            SUBSYSTEM TECHNICAL SPECIFICATION
          </div>

          {selectedNode ? (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {/* Component Title Card */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "rgba(0,24,44,0.85)",
                  border: `1px solid ${getNodeColor(selectedNode)}66`,
                  borderRadius: 8,
                  boxShadow: `0 0 16px ${getNodeColor(selectedNode)}22`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{selectedNode.icon}</span>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      {selectedNode.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: getNodeColor(selectedNode) }}>
                      CODE: {selectedNode.code} · GROUP: {GROUP_COLORS[selectedNode.group]?.label}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, marginTop: 6 }}>
                  {selectedNode.specs.description}
                </div>
                <button
                  onClick={() => focusOnNode(selectedNode)}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "5px 10px",
                    background: "rgba(0,240,255,0.18)",
                    border: "1px solid #00f0ff",
                    borderRadius: 4,
                    color: "#00f0ff",
                    fontFamily: "var(--font-mono)",
                    fontSize: 8.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "0 0 8px rgba(0,240,255,0.25)",
                  }}
                >
                  <span>🔍</span> ZOOM &amp; FOCUS BLUEPRINT
                </button>
              </div>

              {/* Live Status & Redundancy Overview */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(0,18,34,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>HEALTH STATUS</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: getNodeColor(selectedNode) }}>
                    {getNodeStatus(selectedNode.id).toUpperCase()} ({getNodeHealth(selectedNode.id).toFixed(0)}%)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>REDUNDANCY</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "#00ffcc", fontWeight: 700 }}>
                    {selectedNode.specs.redundancy}
                  </div>
                </div>
              </div>

              {/* Engineering Specs Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {selectedNode.specs.voltage && (
                  <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>OPERATING VOLTAGE</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: "#ff9500" }}>{selectedNode.specs.voltage}</div>
                  </div>
                )}
                {selectedNode.specs.power && (
                  <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>POWER RATING</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: "#00ffcc" }}>{selectedNode.specs.power}</div>
                  </div>
                )}
                {selectedNode.specs.temp && (
                  <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>THERMAL RANGE</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: "#ff6b35" }}>{selectedNode.specs.temp}</div>
                  </div>
                )}
                <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>COMPONENT MASS</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: "#00d4ff" }}>{selectedNode.specs.mass}</div>
                </div>
              </div>

              {/* Interconnect Bus Architecture */}
              <div style={{ padding: "10px 12px", background: "rgba(0,18,34,0.6)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "#00f0ff", marginBottom: 3 }}>DATA &amp; POWER BUS:</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(255,255,255,0.85)" }}>
                  {selectedNode.specs.bus}
                </div>
              </div>

              {/* Subsystem Connections */}
              <div style={{ padding: "10px 12px", background: "rgba(0,18,34,0.6)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                  DIRECT INTERFACES ({selectedNode.connections.length})
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {selectedNode.connections.length > 0 ? (
                    selectedNode.connections.map((tgtId) => {
                      const tgt = nodes.find((n) => n.id === tgtId);
                      return (
                        <button
                          key={tgtId}
                          onClick={() => setSelectedNodeId(tgtId)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid rgba(0,240,255,0.3)",
                            background: "rgba(0,240,255,0.12)",
                            color: "#00f0ff",
                            fontFamily: "var(--font-mono)",
                            fontSize: 7.5,
                            cursor: "pointer",
                          }}
                        >
                          → {tgt?.code || tgtId.toUpperCase()}
                        </button>
                      );
                    })
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.35)" }}>TERMINAL ENDPOINT</span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 20 }}>
              SELECT ANY SUBSYSTEM NODE TO VIEW SPECS
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchitectureSelectionScreen;
