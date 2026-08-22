import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useMissionStore } from "../../store/missionStore";

// ─── Subsystem Definitions per Mission Type ────────────────────────────────
type SubsystemNode = {
  id: string; label: string; x: number; y: number; icon: string;
  connections?: string[];
  group: "power" | "structure" | "propulsion" | "comms" | "compute" | "payload" | "thermal" | "crew";
};

function getSubsystems(missionType: string, destination: string): SubsystemNode[] {
  const isHuman = missionType === "human" || destination?.includes("lunar") || destination?.includes("mars");
  const isMars = destination?.includes("mars");
  const isDeepSpace = destination?.includes("mars") || destination?.includes("asteroid") || destination?.includes("deep");
  const isGEO = destination?.includes("geo") || destination?.includes("comms");

  const base: SubsystemNode[] = [
    // Power
    { id: "solar",    label: "SOLAR ARRAY",      x: 60,  y: 80,  icon: "⚡", group: "power",     connections: ["battery", "eps"] },
    { id: "battery",  label: "BATTERY PACK",     x: 60,  y: 220, icon: "🔋", group: "power",     connections: ["eps"] },
    { id: "eps",      label: "POWER (EPS)",       x: 220, y: 150, icon: "⚡", group: "power",     connections: ["obc", "comms", "payload", "thermal", "gnc"] },
    // Compute
    { id: "obc",      label: "FLIGHT COMPUTER",  x: 420, y: 80,  icon: "💻", group: "compute",   connections: ["gnc", "comms", "payload", "telemetry"] },
    { id: "telemetry",label: "TELEMETRY",         x: 580, y: 80,  icon: "📡", group: "compute",   connections: [] },
    // Attitude & Navigation
    { id: "gnc",      label: "GNC / ADCS",        x: 420, y: 220, icon: "🎯", group: "structure", connections: ["rcs", "startracker"] },
    { id: "startracker",label:"STAR TRACKER",     x: 260, y: 290, icon: "⭐", group: "structure", connections: [] },
    { id: "rcs",      label: "REACTION CTRL",    x: 580, y: 220, icon: "🚀", group: "propulsion", connections: [] },
    // Comms
    { id: "comms",    label: "COMMS / ANTENNA",   x: 420, y: 360, icon: "📡", group: "comms",     connections: ["transponder"] },
    { id: "transponder",label:"TRANSPONDER",      x: 580, y: 360, icon: "📻", group: "comms",     connections: [] },
    // Thermal
    { id: "thermal",  label: "THERMAL CTRL",     x: 220, y: 360, icon: "🌡", group: "thermal",   connections: ["radiator"] },
    { id: "radiator", label: "RADIATOR",          x: 60,  y: 360, icon: "♨", group: "thermal",   connections: [] },
    // Payload
    { id: "payload",  label: "PAYLOAD",           x: 420, y: 500, icon: "🛰", group: "payload",   connections: [] },
  ];

  // Propulsion
  if (isDeepSpace || isMars) {
    base.push({ id: "mainengine", label: "MAIN ENGINE", x: 700, y: 150, icon: "🔥", group: "propulsion", connections: ["rcs"] });
    base.push({ id: "propellant", label: "PROPELLANT",  x: 700, y: 290, icon: "⛽", group: "propulsion", connections: ["mainengine"] });
  } else {
    base.push({ id: "mainengine", label: "THRUSTER",    x: 700, y: 150, icon: "🔥", group: "propulsion", connections: ["rcs"] });
    base.push({ id: "propellant", label: "PROPELLANT",  x: 700, y: 290, icon: "⛽", group: "propulsion", connections: ["mainengine"] });
  }

  // Human spaceflight extras
  if (isHuman) {
    base.push({ id: "eclss",    label: "ECLSS",         x: 700, y: 430, icon: "🌬", group: "crew",   connections: ["eps", "obc"] });
    base.push({ id: "habmod",   label: "HABITAT MOD",   x: 580, y: 500, icon: "🏠", group: "crew",   connections: ["eclss", "thermal"] });
    base.push({ id: "medmon",   label: "MED MONITOR",   x: 700, y: 540, icon: "❤", group: "crew",   connections: ["eclss", "obc"] });
  }

  // GEO comms extras
  if (isGEO) {
    base.push({ id: "hga", label: "HIGH GAIN ANT", x: 580, y: 440, icon: "📡", group: "comms", connections: ["comms"] });
    base.push({ id: "transponder2", label: "KU-BAND",  x: 700, y: 440, icon: "📻", group: "comms", connections: ["hga"] });
  }

  return base;
}

const GROUP_COLORS: Record<string, string> = {
  power:      "#ff8c00",
  structure:  "#00d4ff",
  propulsion: "#ff2d55",
  comms:      "#9b5de5",
  compute:    "#00ff88",
  payload:    "#00d4ff",
  thermal:    "#ff6b35",
  crew:       "#00ff88",
};

// ─── Architecture Configs ─────────────────────────────────────────────────
const ARCH_OPTIONS = [
  { id: "human-lunar", name: "Human Lunar Module", type: "human", dest: "lunar-surface", mass: 45000, power: 12000, desc: "Crewed lander with ECLSS, ascent/descent stages and lunar rover." },
  { id: "leo-sat",     name: "LEO Satellite",      type: "robotic", dest: "earth-orbit", mass: 2800,  power: 4500,  desc: "High-resolution Earth observation satellite in low-Earth orbit." },
  { id: "geo-relay",   name: "GEO Relay",          type: "comms",   dest: "geo-orbit",   mass: 5200,  power: 18000, desc: "Geostationary broadband relay with Ku-band + Ka-band transponders." },
  { id: "mars-probe",  name: "Mars Probe",         type: "robotic", dest: "mars-surface", mass: 900,  power: 800,   desc: "Interplanetary probe with ion thruster and RTG power backup." },
  { id: "deep-space",  name: "Deep Space Explorer",type: "robotic", dest: "deep-space",  mass: 1200,  power: 600,   desc: "Long-duration deep-space observatory with high-gain antenna." },
];

// ─── Component ────────────────────────────────────────────────────────────
export const ArchitectureSelectionScreen: React.FC = () => {
  const satellite    = useMissionStore((s) => s.satellite);
  const telemetry    = useMissionStore((s) => s.telemetry);
  const activeThreats = useMissionStore((s) => s.activeThreats);

  const [selectedArch, setSelectedArch] = useState(ARCH_OPTIONS[0]);
  const [hoveredNode, setHoveredNode]   = useState<string | null>(null);
  const [zoom, setZoom]                 = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodes = getSubsystems(selectedArch.type, selectedArch.dest);

  // Compute subsystem health from satellite telemetry
  const getNodeHealth = (nodeId: string): number => {
    if (!satellite?.subsystems) return 100;
    const sub = satellite.subsystems.find((s) =>
      s.name.toLowerCase().includes(nodeId) ||
      nodeId.includes(s.name.toLowerCase().split(" ")[0])
    );
    if (sub) return sub.health;
    // Infer from telemetry
    if (nodeId === "battery"  && telemetry) return telemetry.power.batteryPercent;
    if (nodeId === "solar"    && telemetry) return Math.min(100, (telemetry.power.solarGenerationW / 300) * 100);
    if (nodeId === "obc"      && telemetry) return 100 - telemetry.compute.cpuPercent * 0.3;
    if (nodeId === "comms"    && telemetry) return telemetry.comm.uptime;
    if (nodeId === "thermal"  && telemetry) return telemetry.thermal.cpuTempC < 60 ? 100 : telemetry.thermal.cpuTempC < 80 ? 70 : 40;
    return 100;
  };

  const getNodeStatus = (nodeId: string): "nominal" | "warning" | "failed" => {
    // Check if any active threat targets this node
    const threatened = activeThreats.some((t) => {
      const typ = (t.type ?? "").toLowerCase();
      return (
        (nodeId.includes("power") || nodeId === "battery" || nodeId === "solar" || nodeId === "eps") && typ.includes("power") ||
        (nodeId === "comms" || nodeId === "transponder") && typ.includes("comm") ||
        nodeId === "thermal" && typ.includes("thermal") ||
        (nodeId === "obc" || nodeId === "gnc") && typ.includes("radiation") ||
        typ.includes(nodeId)
      );
    });
    if (threatened) return "failed";
    const h = getNodeHealth(nodeId);
    if (h >= 70) return "nominal";
    if (h >= 40) return "warning";
    return "failed";
  };

  const nodeColor = (nodeId: string): string => {
    const st = getNodeStatus(nodeId);
    return st === "failed" ? "#ff2d55" : st === "warning" ? "#ff8c00" : GROUP_COLORS[(nodes.find((n) => n.id === nodeId)?.group ?? "structure")];
  };

  const resetZoom = () => setZoom(1);

  const SW = 800, SH = 620;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#020409", paddingBottom: 56, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 12px", borderBottom: "1px solid rgba(0,212,255,0.1)", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900, color: "#00d4ff", letterSpacing: "0.1em", marginBottom: 4 }}>
          SPACECRAFT ARCHITECTURE VIEWER
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
          Interactive subsystem diagram — status synchronized with telemetry, threats and simulation
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT: Architecture Selection */}
        <div style={{ width: 260, flexShrink: 0, overflowY: "auto", borderRight: "1px solid rgba(0,212,255,0.08)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,212,255,0.6)", letterSpacing: "0.2em", marginBottom: 6 }}>SELECT ARCHITECTURE</div>
          {ARCH_OPTIONS.map((arch) => (
            <motion.div key={arch.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => setSelectedArch(arch)}
              style={{ padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: selectedArch.id === arch.id ? "rgba(0,212,255,0.1)" : "rgba(5,12,25,0.8)", border: `1px solid ${selectedArch.id === arch.id ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.06)"}`, transition: "all 0.2s" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: selectedArch.id === arch.id ? "#00d4ff" : "#fff", marginBottom: 4 }}>{arch.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{arch.desc}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>MASS: {arch.mass.toLocaleString()} kg</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>PWR: {arch.power.toLocaleString()} W</span>
              </div>
            </motion.div>
          ))}

          {/* Live subsystem table from satellite config */}
          {satellite?.subsystems && satellite.subsystems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,212,255,0.6)", letterSpacing: "0.15em", marginBottom: 8 }}>LIVE SUBSYSTEM STATUS</div>
              {satellite.subsystems.map((sub) => {
                const col = sub.health > 70 ? "#00ff88" : sub.health > 40 ? "#ff8c00" : "#ff2d55";
                return (
                  <div key={sub.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{sub.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: col }}>{sub.health}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: SVG Architecture Diagram */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.4)" }}>ZOOM:</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} style={{ padding: "3px 10px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 4, color: "#00d4ff", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10 }}>+</button>
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} style={{ padding: "3px 10px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 4, color: "#00d4ff", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10 }}>−</button>
            <button onClick={resetZoom} style={{ padding: "3px 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9 }}>FIT</button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{Math.round(zoom * 100)}%</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
              ARCH: {selectedArch.name} | NODES: {nodes.length} | THREATS: {activeThreats.length}
            </span>
            {/* Legend */}
            <div style={{ display: "flex", gap: 10, marginLeft: 16 }}>
              {[["#00ff88", "NOMINAL"], ["#ff8c00", "WARNING"], ["#ff2d55", "FAILED"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(255,255,255,0.4)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable SVG container */}
          <div style={{ flex: 1, overflow: "auto", cursor: "grab" }}>
            <div style={{ minWidth: SW * zoom + 32, minHeight: SH * zoom + 32, padding: 16 }}>
              <svg ref={svgRef}
                width={SW * zoom}
                height={SH * zoom}
                viewBox={`0 0 ${SW} ${SH}`}
                style={{ display: "block", background: "rgba(5,12,25,0.7)", borderRadius: 10, border: "1px solid rgba(0,212,255,0.08)" }}
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Connection lines */}
                {nodes.map((node) =>
                  (node.connections ?? []).map((targetId) => {
                    const target = nodes.find((n) => n.id === targetId);
                    if (!target) return null;
                    const srcColor = nodeColor(node.id);
                    return (
                      <line key={`${node.id}-${targetId}`}
                        x1={node.x + 40} y1={node.y + 28}
                        x2={target.x + 40} y2={target.y + 28}
                        stroke={srcColor}
                        strokeWidth={hoveredNode === node.id || hoveredNode === targetId ? 2 : 0.8}
                        strokeOpacity={hoveredNode === node.id || hoveredNode === targetId ? 0.8 : 0.25}
                        strokeDasharray={getNodeStatus(node.id) === "failed" ? "4,4" : "none"}
                      />
                    );
                  })
                )}

                {/* Subsystem nodes */}
                {nodes.map((node) => {
                  const st = getNodeStatus(node.id);
                  const col = nodeColor(node.id);
                  const h = getNodeHealth(node.id);
                  const isHovered = hoveredNode === node.id;
                  return (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{ cursor: "pointer" }}>
                      {/* Background rect */}
                      <rect x={0} y={0} width={80} height={56} rx={6}
                        fill={isHovered ? `${col}18` : "rgba(5,15,30,0.9)"}
                        stroke={col}
                        strokeWidth={isHovered ? 2 : 1}
                        strokeOpacity={isHovered ? 0.9 : 0.5}
                        filter={st === "failed" ? "url(#glow)" : undefined}
                      />
                      {/* Status indicator dot */}
                      <circle cx={70} cy={8} r={4} fill={col} opacity={0.9} />
                      {/* Icon */}
                      <text x={12} y={24} fontSize={14} style={{ fontFamily: "system-ui" }}>{node.icon}</text>
                      {/* Label */}
                      <text x={40} y={36} textAnchor="middle" fontSize={7}
                        fill={col} fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.05em">
                        {node.label}
                      </text>
                      {/* Health bar */}
                      <rect x={6} y={44} width={68} height={4} rx={2} fill="rgba(255,255,255,0.06)" />
                      <rect x={6} y={44} width={Math.max(0, (h / 100) * 68)} height={4} rx={2} fill={col} opacity={0.7} />
                      {/* Failure flash */}
                      {st === "failed" && (
                        <rect x={0} y={0} width={80} height={56} rx={6} fill="rgba(255,45,85,0.05)"
                          stroke="#ff2d55" strokeWidth={1.5} strokeOpacity={0.6}
                          style={{ animation: "threat-alert 1s ease-in-out infinite" }} />
                      )}
                      {/* Tooltip on hover */}
                      {isHovered && (
                        <g transform="translate(85,0)">
                          <rect x={0} y={0} width={110} height={48} rx={4} fill="rgba(5,12,25,0.95)" stroke="rgba(0,212,255,0.3)" strokeWidth={1} />
                          <text x={6} y={14} fontSize={8} fill="#00d4ff" fontFamily="var(--font-mono)" fontWeight="700">{node.label}</text>
                          <text x={6} y={26} fontSize={7} fill={col} fontFamily="var(--font-mono)">STATUS: {st.toUpperCase()}</text>
                          <text x={6} y={38} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="var(--font-mono)">HEALTH: {h.toFixed(0)}%</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureSelectionScreen;
