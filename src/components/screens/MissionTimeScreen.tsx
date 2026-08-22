import { useMissionStore } from "../../store/missionStore";
import { motion } from "framer-motion";
import { backendWS } from "../../services/BackendWebSocketService";
import { formatElapsed } from "./MissionControlScreen";

const SPEED_OPTIONS = [
  { value: 1,     label: "1x",    sub: "REAL TIME" },
  { value: 100,   label: "100x",  sub: "~14 MIN/DAY" },
  { value: 1000,  label: "1Kx",   sub: "~86 S/DAY" },
  { value: 6000,  label: "6Kx",   sub: "~14 S/DAY" },
  { value: 18000, label: "18Kx",  sub: "~4.8 S/DAY" },
];

function ProgressBar({ label, pct, color, leftLabel, rightLabel, height = 10 }: {
  label: string; pct: number; color: string; leftLabel: string; rightLabel: string; height?: number;
}) {
  const p = Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color }}>{Math.round(p)}%</span>
      </div>
      <div style={{ width: "100%", height, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${p}%`, background: `linear-gradient(90deg,${color}99,${color})`, borderRadius: 6, transition: "width 0.4s ease", boxShadow: `0 0 10px ${color}55` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{leftLabel}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{rightLabel}</span>
      </div>
    </div>
  );
}

export function MissionTimeScreen() {
  const missionDay        = useMissionStore((s) => s.missionDay);
  const timeMultiplier    = useMissionStore((s) => s.timeMultiplier);
  const isPaused          = useMissionStore((s) => s.isPaused);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);
  const pauseMission      = useMissionStore((s) => s.pauseMission);
  const resumeMission     = useMissionStore((s) => s.resumeMission);
  const resetSimulation   = useMissionStore((s) => s.resetSimulation);
  const totalDays         = useMissionStore((s) => s.totalMissionDurationDays);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const milestones        = useMissionStore((s) => s.milestones);
  const missionPhase      = useMissionStore((s) => s.missionPhase);
  const status            = useMissionStore((s) => s.status);
  const rulDays           = useMissionStore((s) => s.rulDays);

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    if (backendWS.isConnected) backendWS.setTimeMultiplier(val);
  };

  const years = Math.floor(missionDay / 365);
  const remDays = Math.floor(missionDay % 365);
  const timePct = totalDays > 0 ? Math.min(100, (missionDay / totalDays) * 100) : 0;
  const objPct  = isNaN(objectiveProgress) ? 0 : Math.min(100, objectiveProgress);
  const completedCount = milestones.filter((m) => m.completed).length;
  const isComplete = status === "completed";
  const nextM = milestones.find((m) => !m.completed);
  const warpLabel = timeMultiplier >= 1000 ? `${timeMultiplier / 1000}Kx` : `${timeMultiplier}x`;

  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", background: "#020409", padding: "32px", paddingBottom: 80 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Clock */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.25em", color: "rgba(0,212,255,0.7)", marginBottom: 8 }}>
            MISSION SIMULATION CLOCK & TIME WARP CONTROL
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(52px,8vw,96px)", fontWeight: 900, color: isComplete ? "#00ff88" : "#00d4ff", letterSpacing: "0.08em", lineHeight: 1 }}>
            {String(Math.floor(missionDay)).padStart(4, "0")}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>ELAPSED MISSION DAYS</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#00d4ff", marginTop: 6, letterSpacing: "0.08em" }}>T+{formatElapsed(missionDay)}</div>
          {isPaused && <div style={{ marginTop: 10, display: "inline-block", padding: "5px 14px", background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.4)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "#ff8c00", letterSpacing: "0.1em" }}>SIMULATION PAUSED</div>}
          {isComplete && <div style={{ marginTop: 10, display: "inline-block", padding: "5px 14px", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.4)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "#00ff88", letterSpacing: "0.1em" }}>MISSION COMPLETE</div>}
          {years > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#00ff88", marginTop: 4 }}>{years} YEAR{years > 1 ? "S" : ""} {remDays} DAYS IN FLIGHT</div>}
        </motion.div>

        {/* Warp controls */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ background: "rgba(5,12,25,0.92)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, padding: "24px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "rgba(0,212,255,0.7)" }}>TIME ACCELERATION WARP FACTOR</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: isPaused ? "#ff8c00" : "#00ff88" }}>{isPaused ? "PAUSED" : `ACTIVE: ${warpLabel}`}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 14 }}>
            {SPEED_OPTIONS.map((opt) => {
              const active = !isPaused && timeMultiplier === opt.value;
              return (
                <button key={opt.value} onClick={() => { handleWarpChange(opt.value); if (isPaused) resumeMission(); }}
                  style={{ padding: "14px 8px", background: active ? "rgba(0,212,255,0.2)" : "rgba(0,0,0,0.3)", border: `1px solid ${active ? "#00d4ff" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: active ? "#00d4ff" : "rgba(255,255,255,0.5)", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: active ? "0 0 20px rgba(0,212,255,0.2)" : "none" }}>
                  {opt.label}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, marginTop: 3, color: active ? "#00ff88" : "rgba(255,255,255,0.25)" }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            {!isPaused
              ? <button onClick={pauseMission} style={{ flex: 1, padding: "10px", borderRadius: 6, cursor: "pointer", background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.35)", color: "#ff8c00", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>PAUSE</button>
              : <button onClick={resumeMission} style={{ flex: 1, padding: "10px", borderRadius: 6, cursor: "pointer", background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.35)", color: "#00ff88", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>RESUME</button>}
            <button onClick={resetSimulation} style={{ flex: 1, padding: "10px", borderRadius: 6, cursor: "pointer", background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.25)", color: "#ff2d55", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em" }}>RESET</button>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
            Time acceleration affects simulation time only. Telemetry, orbit, AI, events and Black Box remain synchronized.
          </div>
        </motion.div>

        {/* Dual Progress Bars */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{ background: "rgba(5,12,25,0.92)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: "24px", marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "rgba(0,212,255,0.7)", marginBottom: 20 }}>
            MISSION LIFECYCLE  |  PHASE: {(missionPhase ?? "OPERATIONS").toUpperCase().replace(/-/g, " ")}
            {rulDays > 0 && <span style={{ marginLeft: 16, color: "rgba(255,255,255,0.3)" }}>EST. RUL: {Math.max(0, rulDays).toFixed(1)} DAYS</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <ProgressBar label="TIME PROGRESS  (elapsed days vs planned mission duration)" pct={timePct} color="#00d4ff" leftLabel="LAUNCH DAY 0" rightLabel={`PLANNED END: DAY ${totalDays}`} />
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
            <ProgressBar label="OBJECTIVE PROGRESS  (milestones achieved)" pct={objPct} color="#00ff88" leftLabel={`${completedCount} / ${milestones.length} MILESTONES COMPLETE`} rightLabel={isComplete ? "ALL OBJECTIVES ACHIEVED" : `NEXT: DAY ${nextM?.requiresDays?.toFixed(1) ?? "--"}`} height={12} />
          </div>
        </motion.div>

        {/* Milestones */}
        <div style={{ background: "rgba(5,12,25,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "24px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,212,255,0.7)", letterSpacing: "0.15em", marginBottom: 12 }}>MISSION MILESTONES & PHASE TIMELINE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {milestones.map((m) => {
              const isNext = !m.completed && nextM?.id === m.id;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: m.completed ? "rgba(0,255,136,0.04)" : isNext ? "rgba(0,212,255,0.04)" : "rgba(0,0,0,0.25)", border: `1px solid ${m.completed ? "rgba(0,255,136,0.15)" : isNext ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.04)"}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: m.completed ? "#00ff88" : isNext ? "#00d4ff" : "rgba(255,255,255,0.2)", fontSize: 12 }}>{m.completed ? "v" : isNext ? ">" : "o"}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.completed ? "#fff" : isNext ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.4)" }}>{m.label}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: m.completed ? "#00ff88" : isNext ? "#00d4ff" : "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                    {m.completed ? `DONE - DAY ${m.requiresDays}` : `DAY ${m.requiresDays}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
