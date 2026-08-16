"""
VYOM Backend — Command & Safety Engine
Command lifecycle: PENDING → VALIDATED → QUEUED → EXECUTING → ACKNOWLEDGED → COMPLETE
"""
import time
import uuid
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from engines.spacecraft_state import SpacecraftState


# ── Safety Rules ──────────────────────────────────────────────────────────────
def check_safety(cmd_type: str, params: Dict, state: SpacecraftState) -> Optional[str]:
    """
    Returns rejection reason string if unsafe, None if safe.
    """
    # Cannot execute thruster burn with battery < 15%
    if cmd_type in ["THRUSTER_ASSIST_MODE", "MOMENTUM_DUMP"] and state.battery_percent < 15:
        return "Battery too low for thruster operation (< 15%)"

    # Cannot re-enable safe mode if already active
    if cmd_type == "SAFE_MODE_ENABLE" and state.safe_mode:
        return "Safe mode already active"

    # Cannot send non-essential commands during critical comm blackout
    if cmd_type not in ["SAFE_MODE_ENABLE", "EMERGENCY_LOAD_SHEDDING", "REDUCE_POWER_LOAD"] \
            and state.signal_dbm < -120:
        return "Comm blackout — only critical commands allowed"

    # Cannot burn propulsion if propulsion anomaly active
    if cmd_type in ["THRUSTER_ASSIST_MODE", "MOMENTUM_DUMP"] and "propulsion_anomaly" in state.active_faults:
        return "Propulsion anomaly active — thruster burn unsafe"

    return None  # safe


@dataclass
class Command:
    id: str
    mission_id: str
    command_type: str
    params: Dict
    status: str = "PENDING"       # PENDING|VALIDATED|QUEUED|EXECUTING|ACKNOWLEDGED|COMPLETE|REJECTED
    submitted_at: float = field(default_factory=time.time)
    validated_at: Optional[float] = None
    executed_at: Optional[float] = None
    acknowledged_at: Optional[float] = None
    result: Optional[str] = None
    rejected_reason: Optional[str] = None
    mission_day: float = 0.0


class CommandEngine:
    """Manages command lifecycle with safety validation."""

    def __init__(self, mission_id: str):
        self.mission_id = mission_id
        self.commands: Dict[str, Command] = {}
        self._pending_queue: List[Command] = []

    def submit(self, command_type: str, params: Dict, state: SpacecraftState,
               mission_day: float) -> Command:
        cmd = Command(
            id=str(uuid.uuid4())[:12],
            mission_id=self.mission_id,
            command_type=command_type,
            params=params,
            mission_day=mission_day,
        )
        self.commands[cmd.id] = cmd

        # Validate immediately
        rejection = check_safety(command_type, params, state)
        if rejection:
            cmd.status = "REJECTED"
            cmd.rejected_reason = rejection
            return cmd

        cmd.status = "VALIDATED"
        cmd.validated_at = time.time()
        self._pending_queue.append(cmd)
        return cmd

    def execute_pending(self, state: SpacecraftState) -> List[Command]:
        """Execute all queued commands. Modifies spacecraft state in-place."""
        executed = []
        new_queue = []
        for cmd in self._pending_queue:
            if cmd.status in ["VALIDATED", "QUEUED"]:
                cmd.status = "EXECUTING"
                cmd.executed_at = time.time()
                self._apply_command(cmd, state)
                cmd.status = "COMPLETE"
                cmd.acknowledged_at = time.time()
                cmd.result = f"Executed: {cmd.command_type} applied to spacecraft state"
                executed.append(cmd)
            else:
                new_queue.append(cmd)
        self._pending_queue = new_queue
        return executed

    def _apply_command(self, cmd: Command, state: SpacecraftState) -> None:
        """Apply command effects to spacecraft state."""
        ct = cmd.command_type
        p = cmd.params

        if ct == "SAFE_MODE_ENABLE":
            state.safe_mode = True
            state.cpu_percent = min(state.cpu_percent, 25)
            state.power_consumption_w *= 0.4

        elif ct == "REDUCE_POWER_LOAD":
            target_w = p.get("target_consumption_w", 100)
            state.power_consumption_w = min(state.power_consumption_w, target_w)

        elif ct == "EMERGENCY_LOAD_SHEDDING":
            shed = p.get("shed_watts", 150)
            state.power_consumption_w = max(50, state.power_consumption_w - shed)
            state.safe_mode = True

        elif ct == "ACTIVATE_THERMAL_SHUNT":
            # Increase radiator effectiveness → target temp drops toward nominal
            state.cpu_temp_c = min(state.cpu_temp_c, state.cpu_temp_c * 0.85)
            state.radiator_health = 1.0

        elif ct == "REDUCE_CPU_LOAD":
            target = p.get("target_cpu_pct", 25)
            state.cpu_percent = min(state.cpu_percent, target)

        elif ct == "SWITCH_ANTENNA":
            state.signal_dbm += 12.0   # backup omni: +12 dBm gain
            state.comm_ok = True

        elif ct == "RECALIBRATE_COMM":
            state.packet_loss_pct = max(0, state.packet_loss_pct * 0.3)
            state.data_rate_mbps = max(state.data_rate_mbps, 2.0)

        elif ct == "MOMENTUM_DUMP":
            state.reaction_wheel_rpm = 3240.0  # reset to nominal
            state.angular_vel_degs *= 0.2

        elif ct == "GYRO_RECALIBRATION":
            state.roll_deg *= 0.1
            state.pitch_deg *= 0.1
            state.yaw_deg *= 0.1

        elif ct == "THRUSTER_ASSIST_MODE":
            state.angular_vel_degs *= 0.1

        elif ct == "ISOLATE_THRUSTER_VALVE":
            state.propulsion_ok = False   # isolate = disable
            state.thrust_n = 0
            # Remove propulsion anomaly fault effect
            state.active_faults.pop("propulsion_anomaly", None)

        elif ct == "ORIENT_SPACECRAFT":
            mode = p.get("mode", "nominal")
            if mode == "radiation_min_profile":
                # Turn minimal cross-section to solar wind
                state.radiation_level_usv_h *= 0.7

        elif ct == "SUSPEND_NON_ESSENTIAL":
            systems = p.get("systems", [])
            for sys_name in systems:
                sys = state.get_subsystem(sys_name)
                if sys:
                    sys.status = "nominal"   # suspended but stable

        elif ct == "RADIATION_SAFE_MODE":
            state.radiation_level_usv_h *= 0.6
            state.cpu_percent = min(state.cpu_percent, 30)

        elif ct == "MEMORY_SCRUBBING":
            # Mark OBC as recovering
            obc = state.get_subsystem("On-Board")
            if obc:
                obc.health = min(100, obc.health + 15)

    def to_dict_list(self) -> List[Dict]:
        return [
            {
                "id": c.id,
                "mission_id": c.mission_id,
                "command_type": c.command_type,
                "params": c.params,
                "status": c.status,
                "result": c.result,
                "rejected_reason": c.rejected_reason,
                "executed_at": int(c.executed_at * 1000) if c.executed_at else None,
                "mission_day": c.mission_day,
            }
            for c in sorted(self.commands.values(), key=lambda x: x.submitted_at, reverse=True)
        ]
