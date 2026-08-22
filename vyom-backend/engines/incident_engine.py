import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

class FaultNormalizer:
    """Normalizes raw fault errors into a structured anomaly categorization."""
    
    @staticmethod
    def normalize(raw_error: str, fault_type: str, effects: Dict[str, float]) -> Dict:
        """
        Normalize fault details into a standardized category and subsystem mapping.
        
        Args:
            raw_error: The raw error message or description.
            fault_type: The raw fault type identifier.
            effects: A dictionary mapping effect keys to severity values.
            
        Returns:
            Dictionary containing category, subsystem, severity, root_cause, and confidence.
        """
        fault_lower = fault_type.lower()
        effects_keys = [k.lower() for k in effects.keys()]
        
        category = 'unknown-anomaly'
        subsystem = 'Unknown'
        confidence = 0.5

        # Solar / Radiation
        if 'solar' in fault_lower or any(e in ['solar_storm', 'radiation_spike'] for e in effects_keys):
            category = 'solar-radiation'
            subsystem = 'Radiation/Power'
            confidence = 0.95 if 'solar' in fault_lower else 0.7
            
        # Communication
        elif 'comm' in fault_lower or any(e in ['comm_failure', 'telemetry_loss'] for e in effects_keys):
            category = 'communication-signal'
            subsystem = 'Communication'
            confidence = 0.95 if 'comm' in fault_lower else 0.7
            
        # Power / Battery
        elif 'battery' in fault_lower or 'power' in fault_lower or any(e in ['battery_failure', 'power'] for e in effects_keys):
            category = 'power-electrical'
            subsystem = 'Power'
            confidence = 0.95 if ('battery' in fault_lower or 'power' in fault_lower) else 0.7
            
        # Thermal
        elif 'thermal' in fault_lower:
            category = 'thermal-control'
            subsystem = 'Thermal'
            confidence = 0.95
            
        # Attitude / ADCS
        elif 'attitude' in fault_lower or 'reaction' in fault_lower:
            category = 'attitude-control'
            subsystem = 'ADCS'
            confidence = 0.95
            
        # Propulsion
        elif 'propulsion' in fault_lower or 'thruster' in fault_lower:
            category = 'propulsion-pressure'
            subsystem = 'Propulsion'
            confidence = 0.95
            
        # Sensors / GNC
        elif 'sensor' in fault_lower:
            category = 'sensor-data'
            subsystem = 'GNC'
            confidence = 0.95
            
        severity = max(effects.values()) if effects else 0.0

        return {
            'category': category,
            'subsystem': subsystem,
            'severity': severity,
            'root_cause': raw_error,
            'confidence': confidence
        }

class IncidentEngine:
    """Manages the lifecycle and historical tracking of anomaly incidents."""
    
    def __init__(self):
        self.incidents: Dict[str, Dict] = {}
        self._counter: int = 0

    def create_incident(self, fault_type: str, fault_id: str, raw_error: str, mission_id: str, mission_day: float, effects: Dict, sim_time_s: Optional[float] = None) -> Dict:
        """
        Creates a new incident record from a detected fault.
        """
        self._counter += 1
        now = datetime.now()
        date_str = now.strftime('%Y%m%d')
        # Global uniqueness: per-engine counter + random suffix (multiple
        # simulations can create incidents on the same day)
        incident_id = f"INC-{date_str}-{self._counter:03d}-{uuid.uuid4().hex[:4]}"

        normalized = FaultNormalizer.normalize(raw_error, fault_type, effects)

        incident = {
            'incident_id': incident_id,
            'fault_id': fault_id,
            'mission_id': mission_id,
            'mission_day': mission_day,
            'detection_time_ms': int(time.time() * 1000),
            'detection_sim_s': sim_time_s,
            'status': 'detected',
            'normalized_fault': normalized,
            'effects': effects
        }
        self.incidents[incident_id] = incident
        return incident

    def record_diagnosis(self, incident_id: str, ai_diagnosis: Dict, sim_time_s: Optional[float] = None) -> None:
        """Records an AI diagnosis for an incident."""
        if incident_id in self.incidents:
            inc = self.incidents[incident_id]
            inc['diagnosis_time_ms'] = int(time.time() * 1000)
            # Never downgrade an incident that has already progressed past diagnosis
            if inc.get('status') in (None, 'detected', 'diagnosing'):
                inc['status'] = 'diagnosing'
            inc['ai_analysis'] = ai_diagnosis
            if sim_time_s is not None:
                inc['diagnosis_sim_s'] = sim_time_s

    def record_decision(self, incident_id: str, recovery_mode: str, action: str, sim_time_s: Optional[float] = None) -> None:
        """Records a recovery decision for an incident."""
        if incident_id in self.incidents:
            inc = self.incidents[incident_id]
            inc['decision_time_ms'] = int(time.time() * 1000)
            inc['recovery_mode'] = recovery_mode
            inc['action'] = action
            if sim_time_s is not None:
                inc['decision_sim_s'] = sim_time_s

    def start_recovery(self, incident_id: str, sim_time_s: Optional[float] = None) -> None:
        """Marks the start of the recovery phase for an incident."""
        if incident_id in self.incidents:
            inc = self.incidents[incident_id]
            inc['recovery_start_time_ms'] = int(time.time() * 1000)
            inc['status'] = 'recovering'
            if sim_time_s is not None:
                inc['recovery_start_sim_s'] = sim_time_s

    def complete_recovery(self, incident_id: str, success: bool = True, sim_time_s: Optional[float] = None) -> None:
        """Marks the completion of a recovery attempt and calculates resolution time."""
        if incident_id in self.incidents:
            inc = self.incidents[incident_id]
            end_time = int(time.time() * 1000)
            inc['recovery_end_time_ms'] = end_time
            detection_time = inc.get('detection_time_ms', end_time)
            inc['total_resolution_ms'] = end_time - detection_time
            # Simulation-clock resolution (meaningful under time acceleration)
            if sim_time_s is not None and inc.get('detection_sim_s') is not None:
                inc['total_resolution_sim_s'] = round(sim_time_s - inc['detection_sim_s'], 3)
                inc['recovery_end_sim_s'] = sim_time_s
            inc['status'] = 'resolved' if success else 'failed'
            
    def get_incident(self, incident_id: str) -> Optional[Dict]:
        """Retrieves an incident by its ID."""
        return self.incidents.get(incident_id)
        
    def get_active_incidents(self) -> List[Dict]:
        """Returns all incidents that are not resolved or failed."""
        return [inc for inc in self.incidents.values() if inc.get('status') not in ['resolved', 'failed']]
        
    def get_resolution_timeline(self, incident_id: str) -> Dict:
        """Returns the timing metrics for an incident's lifecycle."""
        inc = self.incidents.get(incident_id, {})
        return {
            'detection': inc.get('detection_time_ms'),
            'diagnosis': inc.get('diagnosis_time_ms'),
            'decision': inc.get('decision_time_ms'),
            'recovery_start': inc.get('recovery_start_time_ms'),
            'recovery_end': inc.get('recovery_end_time_ms'),
            'total_resolution': inc.get('total_resolution_ms')
        }
