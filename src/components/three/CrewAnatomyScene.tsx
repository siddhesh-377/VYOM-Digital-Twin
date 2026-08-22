import React, { useState, useEffect } from "react";
import type { CrewMember } from "../../types/mission";

export type PhysiologicalMode =
  | "temperature"
  | "pressure"
  | "cardio"
  | "respiratory"
  | "fatigue"
  | "radiation"
  | "eclss";

export type BodyRegionId =
  | "head"
  | "chest"
  | "plss"
  | "abdomen"
  | "arm_left"
  | "arm_right"
  | "hand_left"
  | "hand_right"
  | "hips"
  | "leg_left"
  | "leg_right"
  | "feet";

export interface AnatomicalLayers {
  skeletal: boolean;
  cardiovascular: boolean;
  nervous: boolean;
  respiratory: boolean;
  organs: boolean;
  muscular: boolean;
  skin: boolean;
}

export interface BodyRegionData {
  id: BodyRegionId;
  name: string;
  temperature: number;
  tempRange: [number, number];
  pressureKpa: number;
  pressureRange: [number, number];
  muscleFatigue: number;
  radiationDose: number;
  status: "nominal" | "caution" | "warning" | "critical";
  description: string;
}

// ─── Color utility exports ────────────────────────────────────────────────────
export function getThermalColor(tempC: number): string {
  if (tempC < 35.0) return "#00d4ff";
  if (tempC < 36.5) return "#00f0ff";
  if (tempC <= 37.5) return "#00ffaa";
  if (tempC <= 38.2) return "#ff9500";
  return "#ff2d55";
}

export function getPressureColor(pressureKpa: number): string {
  if (pressureKpa < 18) return "#00ffcc";
  if (pressureKpa < 28) return "#00d4ff";
  if (pressureKpa < 38) return "#ff9500";
  return "#ff2d55";
}

export function getVitalColor(
  v: number,
  warn: number,
  crit: number,
  invert = false
): string {
  if (invert) {
    if (v <= crit) return "#ff2d55";
    if (v <= warn) return "#ff9500";
    return "#00ffcc";
  }
  if (v >= crit) return "#ff2d55";
  if (v >= warn) return "#ff9500";
  return "#00ffcc";
}

export function CrewAnatomyScene({
  member,
  mode = "temperature",
  selectedRegion = null,
  onSelectRegion,
  xRay = false,
  showHotspots = false,
  autoRotate = false,
  height = 580,
  layers,
  onToggleLayer,
}: {
  member: CrewMember | null;
  mode?: PhysiologicalMode;
  selectedRegion?: BodyRegionId | null;
  onSelectRegion?: (id: BodyRegionId) => void;
  xRay?: boolean;
  showHotspots?: boolean;
  autoRotate?: boolean;
  height?: number | string;
  layers?: AnatomicalLayers;
  onToggleLayer?: (layer: keyof AnatomicalLayers) => void;
}) {
  const hr = member?.heartRateBpm ?? 74;
  const spo2 = member?.spo2Percent ?? 99.1;
  const coreTemp = member?.coreTempC ?? 36.8;
  const stress = member?.stressIndex ?? 20;
  const fatigue = member?.fatigueIndex ?? 18;
  const suitPress = member?.suitPressureKpa ?? 101.3;

  // Laser scanner sweep state
  const [scanY, setScanY] = useState(5);
  useEffect(() => {
    let down = true;
    const interval = setInterval(() => {
      setScanY((prev) => {
        if (prev >= 94) down = false;
        if (prev <= 6) down = true;
        return down ? prev + 0.8 : prev - 0.8;
      });
    }, 35);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height: typeof height === "number" ? `${height}px` : height,
        width: "100%",
        background: "radial-gradient(ellipse at 50% 40%, #031424 0%, #010813 65%, #000308 100%)",
        border: "1px solid rgba(0,240,255,0.35)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "inset 0 0 50px rgba(0,240,255,0.08), 0 8px 32px rgba(0,0,0,0.7)",
      }}
    >
      {/* Sci-Fi Grid Background Matrix */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />

      {/* Top Header Command HUD */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          zIndex: 15,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            color: "#00f0ff",
            letterSpacing: "0.15em",
            background: "rgba(0,18,32,0.9)",
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid rgba(0,240,255,0.45)",
            boxShadow: "0 0 12px rgba(0,240,255,0.25)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ffcc", boxShadow: "0 0 8px #00ffcc" }} />
          HUMAN ANATOMY DIGITAL TWIN · {mode.toUpperCase()} MODE
        </div>
      </div>

      {/* Top Right Live Telemetry Strip */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          zIndex: 15,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {[
          { label: "ECG / PULSE", value: `${hr} BPM`, color: hr > 100 ? "#ff2d55" : "#00ffcc" },
          { label: "SPO2 LEVEL", value: `${spo2.toFixed(1)}%`, color: "#00f0ff" },
          { label: "CORE TEMP", value: `${coreTemp.toFixed(1)}°C`, color: "#00ffcc" },
          { label: "NEURAL STR", value: `${stress}%`, color: stress > 60 ? "#ff9500" : "#00f0ff" },
        ].map((b) => (
          <div
            key={b.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,14,26,0.85)",
              padding: "2px 8px",
              borderRadius: 4,
              border: `1px solid ${b.color}44`,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(255,255,255,0.45)" }}>
              {b.label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: b.color }}>
              {b.value}
            </span>
          </div>
        ))}
      </div>

      {/* Left Sci-Fi Diagnostics Sub-Panel */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 12,
          zIndex: 15,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {/* Axial Brain Scan Inset Widget */}
        <div
          style={{
            width: 82,
            height: 82,
            background: "rgba(0,18,32,0.85)",
            border: "1px solid rgba(0,240,255,0.4)",
            borderRadius: 6,
            padding: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 0 14px rgba(0,240,255,0.18)",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 6.5, color: "#00f0ff", letterSpacing: "0.1em" }}>
            AXIAL BRAIN
          </div>
          <svg width={52} height={52} viewBox="0 0 50 50">
            <ellipse cx={25} cy={25} rx={21} ry={23} fill="none" stroke="#00f0ff" strokeWidth={1} strokeDasharray="3 2" opacity={0.65} />
            <path d="M 25 3 L 25 47 M 3 25 L 47 25" stroke="rgba(0,240,255,0.3)" strokeWidth={0.5} />
            <path d="M 16 12 Q 13 25 18 36" fill="none" stroke="#00f0ff" strokeWidth={1.4} opacity={0.85} />
            <path d="M 34 12 Q 37 25 32 36" fill="none" stroke="#00f0ff" strokeWidth={1.4} opacity={0.85} />
            <circle cx={25} cy={25} r={3.5} fill="#00ffcc" opacity={0.9} />
          </svg>
        </div>

        {/* Spinal Diagnostic Status */}
        <div
          style={{
            width: 82,
            background: "rgba(0,18,32,0.85)",
            border: "1px solid rgba(0,240,255,0.4)",
            borderRadius: 6,
            padding: "5px 6px",
            fontFamily: "var(--font-mono)",
            fontSize: 6.5,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          <div style={{ color: "#00f0ff", fontWeight: 700, marginBottom: 3 }}>SPINAL FEED</div>
          <div>C1–C7: <span style={{ color: "#00ffcc" }}>NOM</span></div>
          <div>T1–T12: <span style={{ color: "#00ffcc" }}>ALIGN</span></div>
          <div>L1–L5: <span style={{ color: "#00f0ff" }}>OK</span></div>
          <div style={{ marginTop: 2, color: "#00ffcc" }}>AXIAL: 99.4%</div>
        </div>
      </div>

      {/* ─── MAIN CLEAN 2D HUMAN ANATOMY IMAGE (ZERO POINTS/DOTS) ─── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Anatomical Image Container */}
        <div
          style={{
            position: "relative",
            height: "94%",
            maxHeight: "540px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Real Human Anatomy Image */}
          <img
            src="/assets/human_anatomy_full.jpg"
            alt="Human Anatomy Crew Digital Twin"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
              filter:
                mode === "temperature"
                  ? "drop-shadow(0 0 25px rgba(0,255,170,0.45)) contrast(1.12) brightness(1.08)"
                  : mode === "pressure"
                  ? "drop-shadow(0 0 25px rgba(255,149,0,0.45)) contrast(1.12) brightness(1.08)"
                  : "drop-shadow(0 0 22px rgba(0,240,255,0.5)) contrast(1.12) brightness(1.08)",
              transition: "filter 0.3s ease",
            }}
          />

          {/* Laser Scanner Sweep Line */}
          <div
            style={{
              position: "absolute",
              left: "-12%",
              right: "-12%",
              top: `${scanY}%`,
              height: 2,
              background: "linear-gradient(90deg, transparent, #00f0ff 25%, #ffffff 50%, #00f0ff 75%, transparent)",
              boxShadow: "0 0 16px #00f0ff, 0 0 28px #00f0ff",
              pointerEvents: "none",
              zIndex: 8,
              transition: "top 0.035s linear",
            }}
          />
        </div>
      </div>

      {/* Bottom Medical Diagnostic Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          right: 12,
          zIndex: 15,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 7.5,
          color: "rgba(0,240,255,0.75)",
          pointerEvents: "none",
          borderTop: "1px solid rgba(0,240,255,0.15)",
          paddingTop: 6,
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ color: "#00f0ff" }}>● SKELETAL &amp; VERTEBRAL MATRIX</span>
          <span style={{ color: "#ff2d55" }}>● ARTERIAL CIRCULATION ({hr} BPM)</span>
          <span style={{ color: "#00ffc8" }}>● NEURAL AXONS</span>
          <span style={{ color: "#00ffaa" }}>● CORE TEMP ({coreTemp.toFixed(1)}°C)</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)" }}>
          USE QUICK REGION STRIP TO INSPECT SPECIFIC ANATOMICAL TELEMETRY
        </div>
      </div>
    </div>
  );
}

export default CrewAnatomyScene;
