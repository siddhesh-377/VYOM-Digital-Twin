"""
VYOM Backend — Manual Recovery Engine
Manages manual recovery procedures and execution.
"""
import time
import uuid
from dataclasses import dataclass, field
from typing import List, Dict, Optional

from engines.spacecraft_state import SpacecraftState
from engines.fault_engine import resolve_fault_type


@dataclass
class RecoveryProcedure:
    id: str
    name: str
    description: str
    applicable_faults: List[str]
    severity_level: str
    steps: List[str]
    commands: List[str]
    estimated_duration_s: float
    risk_level: str
    requires_confirmation: bool


class ManualRecoveryEngine:
    """Manages manual operator-triggered recovery procedures."""

    def __init__(self):
        self.action_log: List[Dict] = []
        self.PROCEDURE_LIBRARY = {
            'PROC-001': RecoveryProcedure(
                id='PROC-001',
                name='Emergency Power Load Reduction',
                description='Shed non-essential loads to maintain critical systems.',
                applicable_faults=['battery_failure', 'solar_panel_degradation'],
                severity_level='warning',
                steps=['Identify non-essential loads', 'Disable payload instruments', 'Switch to backup power bus', 'Monitor voltage recovery'],
                commands=['REDUCE_POWER_LOAD'],
                estimated_duration_s=300.0,
                risk_level='low',
                requires_confirmation=True
            ),
            'PROC-002': RecoveryProcedure(
                id='PROC-002',
                name='Antenna Failover',
                description='Switch to backup antenna to restore communications.',
                applicable_faults=['comm_failure', 'telemetry_loss'],
                severity_level='warning',
                steps=['Switch to redundant antenna', 'Verify signal acquisition', 'Adjust pointing', 'Confirm data rate'],
                commands=['SWITCH_ANTENNA'],
                estimated_duration_s=120.0,
                risk_level='low',
                requires_confirmation=True
            ),
            'PROC-003': RecoveryProcedure(
                id='PROC-003',
                name='Thruster Isolation',
                description='Isolate faulty thruster and switch to backup.',
                applicable_faults=['propulsion_anomaly'],
                severity_level='warning',
                steps=['Close thruster valve', 'Verify isolation', 'Switch to backup thruster set', 'Verify attitude stability'],
                commands=['ISOLATE_THRUSTER_VALVE'],
                estimated_duration_s=180.0,
                risk_level='medium',
                requires_confirmation=True
            ),
            'PROC-004': RecoveryProcedure(
                id='PROC-004',
                name='Safe Mode Entry',
                description='Enter safe mode to protect the spacecraft.',
                applicable_faults=[],  # Applies to ANY critical fault
                severity_level='critical',
                steps=['Disable non-essential systems', 'Point solar arrays to sun', 'Enable minimum power mode', 'Await ground command'],
                commands=['SAFE_MODE_ENABLE'],
                estimated_duration_s=60.0,
                risk_level='high',
                requires_confirmation=True
            ),
            'PROC-005': RecoveryProcedure(
                id='PROC-005',
                name='Momentum Dump',
                description='Desaturate reaction wheels using thrusters.',
                applicable_faults=['attitude_control_failure'],
                severity_level='warning',
                steps=['Prepare thruster firing sequence', 'Execute momentum dump', 'Verify wheel speeds nominal', 'Confirm attitude stability'],
                commands=['MOMENTUM_DUMP'],
                estimated_duration_s=450.0,
                risk_level='medium',
                requires_confirmation=True
            ),
            'PROC-006': RecoveryProcedure(
                id='PROC-006',
                name='Gyro Recalibration',
                description='Recalibrate gyros using star trackers.',
                applicable_faults=['sensor_failure'],
                severity_level='warning',
                steps=['Select reference star field', 'Initialize calibration sequence', 'Cross-reference star tracker', 'Update navigation solution'],
                commands=['GYRO_RECALIBRATION'],
                estimated_duration_s=600.0,
                risk_level='low',
                requires_confirmation=True
            ),
            'PROC-007': RecoveryProcedure(
                id='PROC-007',
                name='Memory Scrubbing',
                description='Scrub memory to fix radiation-induced bit flips.',
                applicable_faults=['radiation_spike'],
                severity_level='warning',
                steps=['Halt non-critical processes', 'Run ECC memory scan', 'Correct bit-flip errors', 'Resume operations'],
                commands=['MEMORY_SCRUBBING'],
                estimated_duration_s=240.0,
                risk_level='low',
                requires_confirmation=True
            ),
            'PROC-008': RecoveryProcedure(
                id='PROC-008',
                name='Thermal Shunt Activation',
                description='Activate thermal shunt to reject excess heat.',
                applicable_faults=['thermal_overheating'],
                severity_level='warning',
                steps=['Open thermal shunt valves', 'Redirect coolant flow', 'Monitor temperature descent', 'Verify payload temps nominal'],
                commands=['REDUCE_POWER_LOAD'],
                estimated_duration_s=360.0,
                risk_level='low',
                requires_confirmation=True
            )
        }

    def get_recovery_procedures(self, fault_type: str, severity: str) -> List[RecoveryProcedure]:
        """Returns applicable procedures for the fault type."""
        canonical_fault = resolve_fault_type(fault_type)
        applicable = []
        for proc in self.PROCEDURE_LIBRARY.values():
            if canonical_fault in proc.applicable_faults:
                applicable.append(proc)
        
        if severity == 'critical':
            # PROC-004 applies to ANY critical fault
            safe_mode_proc = self.PROCEDURE_LIBRARY.get('PROC-004')
            if safe_mode_proc and safe_mode_proc not in applicable:
                applicable.append(safe_mode_proc)
                
        return applicable

    def validate_action(self, procedure_id: str, spacecraft_state: SpacecraftState, severity: str) -> Dict:
        """Validates if a procedure can be executed."""
        if procedure_id not in self.PROCEDURE_LIBRARY:
            return {"valid": False, "reason": "Procedure not found", "execution_mode": "none"}
            
        proc = self.PROCEDURE_LIBRARY[procedure_id]
        
        # Determine execution mode based on severity
        if severity == 'critical':
            execution_mode = 'view-only'
        elif severity == 'warning':
            execution_mode = 'execute-after-confirmation'
        else:
            execution_mode = 'execute'
            
        # Check spacecraft state constraints
        if 'MOMENTUM_DUMP' in proc.commands and spacecraft_state.battery_percent < 15:
            return {"valid": False, "reason": "Battery too low for thruster operation (< 15%)", "execution_mode": execution_mode}
            
        if 'SAFE_MODE_ENABLE' in proc.commands and spacecraft_state.safe_mode:
            return {"valid": False, "reason": "Safe mode already active", "execution_mode": execution_mode}
            
        if 'ISOLATE_THRUSTER_VALVE' in proc.commands and not spacecraft_state.propulsion_ok:
            return {"valid": False, "reason": "Propulsion already isolated/disabled", "execution_mode": execution_mode}
            
        return {"valid": True, "reason": "Validation passed", "execution_mode": execution_mode}

    def execute_procedure(self, incident_id: str, procedure_id: str, operator: str, spacecraft_state: SpacecraftState) -> Dict:
        """Executes a recovery procedure."""
        # For simulation, we assume severity was verified and is warning (not critical)
        # We perform validation here again just to be safe
        # In a real setup, severity would be passed or fetched.
        validation = self.validate_action(procedure_id, spacecraft_state, "warning")
        
        if not validation["valid"]:
            return {
                "success": False, 
                "commands_executed": [], 
                "result": f"Execution failed: {validation['reason']}", 
                "timestamp": int(time.time() * 1000)
            }
            
        if validation["execution_mode"] == 'view-only':
            return {
                "success": False, 
                "commands_executed": [], 
                "result": "Procedure is view-only for operators", 
                "timestamp": int(time.time() * 1000)
            }

        proc = self.PROCEDURE_LIBRARY[procedure_id]
        
        # Apply mock effects directly or queue commands to CommandEngine (here we just return commands for brevity)
        self.record_action(incident_id, operator, procedure_id, ", ".join(proc.commands), "Procedure executed successfully")
        
        return {
            "success": True, 
            "commands_executed": proc.commands, 
            "result": "Procedure executed successfully", 
            "timestamp": int(time.time() * 1000)
        }

    def record_action(self, incident_id: str, operator: str, procedure_id: str, command: str, result: str) -> Dict:
        """Records an action to the log."""
        action = {
            "action_id": str(uuid.uuid4()),
            "incident_id": incident_id,
            "operator": operator,
            "procedure_id": procedure_id,
            "command": command,
            "result": result,
            "timestamp": int(time.time() * 1000)
        }
        self.action_log.append(action)
        return action

    def get_action_log(self, incident_id: Optional[str] = None) -> List[Dict]:
        """Returns the action log, optionally filtered by incident."""
        if incident_id:
            return [a for a in self.action_log if a.get("incident_id") == incident_id]
        return self.action_log
