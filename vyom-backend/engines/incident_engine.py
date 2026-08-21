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

    def create_incident(self, fault_type: str, fault_id: str, raw_error: str, mission_id: str, mission_day: float, effects: Dict) -> Dict:
        """
        Creates a new incident record from a detected fault.
        """
        self._counter += 1
        now = datetime.now()
        date_str = now.strftime('%Y%m%d')
        incident_id = f"INC-{date_str}-{self._counter:03d}"
        
        normalized = FaultNormalizer.normalize(raw_error, fault_type, effects)
        
        incident = {
            'incident_id': incident_id,
            'fault_id': fault_id,
            'mission_id': mission_id,
            'mission_day': mission_day,
            'detection_time_ms': int(time.time() * 1000),
            'status': 'detected',
            'normalized_fault': normalized,
            'effects': effects
        }
        self.incidents[incident_id] = incident
        return incident
        
    def record_diagnosis(self, incident_id: str, ai_diagnosis: Dict) -> None:
        """Records an AI diagnosis for an incident."""
        if incident_id in self.incidents:
            self.incidents[incident_id]['diagnosis_time_ms'] = int(time.time() * 1000)
            self.incidents[incident_id]['status'] = 'diagnosing'
            self.incidents[incident_id]['ai_analysis'] = ai_diagnosis
            
    def record_decision(self, incident_id: str, recovery_mode: str, action: str) -> None:
        """Records a recovery decision for an incident."""
        if incident_id in self.incidents:
            self.incidents[incident_id]['decision_time_ms'] = int(time.time() * 1000)
            self.incidents[incident_id]['recovery_mode'] = recovery_mode
            self.incidents[incident_id]['action'] = action
            
    def start_recovery(self, incident_id: str) -> None:
        """Marks the start of the recovery phase for an incident."""
        if incident_id in self.incidents:
            self.incidents[incident_id]['recovery_start_time_ms'] = int(time.time() * 1000)
            self.incidents[incident_id]['status'] = 'recovering'
            
    def complete_recovery(self, incident_id: str, success: bool = True) -> None:
        """Marks the completion of a recovery attempt and calculates resolution time."""
        if incident_id in self.incidents:
            end_time = int(time.time() * 1000)
            self.incidents[incident_id]['recovery_end_time_ms'] = end_time
            detection_time = self.incidents[incident_id].get('detection_time_ms', end_time)
            self.incidents[incident_id]['total_resolution_ms'] = end_time - detection_time
            self.incidents[incident_id]['status'] = 'resolved' if success else 'failed'
            
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
