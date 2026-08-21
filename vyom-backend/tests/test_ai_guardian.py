"""Tests for the AI Guardian diagnostic pipeline."""
import time
import uuid

from engines.ai_guardian import AIGuardian, ROOT_CAUSE_RULES, MITIGATION_COMMANDS
from engines.anomaly_detector import AnomalyEvent
from engines.spacecraft_state import SpacecraftState


def make_event(channel, severity="warning", confidence=80.0):
    return AnomalyEvent(
        id=str(uuid.uuid4())[:8],
        subsystem="Test",
        channel=channel,
        severity=severity,
        confidence=confidence,
        detection_strategy="threshold",
        description=f"{channel} out of band",
        current_value=0.0,
        threshold=0.0,
        deviation=0.0,
        detected_at=time.time(),
    )


class TestPipelineNoAnomalies:
    def test_returns_none_without_anomalies(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        assert guardian.run_pipeline([], state) is None

    def test_build_ai_analysis_nominal(self):
        guardian = AIGuardian()
        analysis = guardian.build_ai_analysis(None, [])
        assert analysis["anomalyDetected"] is False
        assert analysis["phase"] == "monitoring"
        assert analysis["riskLevel"] == "low"
        assert analysis["reasoningSteps"] == []


class TestRootCauseClassification:
    def test_solar_storm_diagnosis(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("radiation_level_usv_h", "critical"),
            make_event("signal_dbm", "warning"),
            make_event("cpu_temp_c", "warning"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        assert diagnosis is not None
        assert diagnosis.root_cause == "solar_storm"
        assert diagnosis.commands
        assert len(diagnosis.reasoning_steps) == 9

    def test_battery_failure_diagnosis(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("battery_percent", "critical"),
            make_event("voltage_v", "critical"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        assert diagnosis.root_cause == "battery_failure"

    def test_unknown_fallback(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [make_event("mystery_channel_xyz", "critical", confidence=99.0)]
        diagnosis = guardian.run_pipeline(anomalies, state)
        assert diagnosis is not None
        assert diagnosis.root_cause == "unknown_anomaly"

    def test_mitigation_commands_exist_for_all_root_causes(self):
        for rule in ROOT_CAUSE_RULES:
            assert rule["root_cause"] in MITIGATION_COMMANDS, rule["root_cause"]

    def test_suffix_stripped_from_channels(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("radiation_level_usv_h_roc", "critical"),
            make_event("signal_dbm_persist", "warning"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        assert diagnosis.root_cause == "solar_storm"


class TestBuildAIAnalysis:
    def test_diagnosis_present(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("radiation_level_usv_h", "critical"),
            make_event("signal_dbm", "warning"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        analysis = guardian.build_ai_analysis(diagnosis, anomalies)
        assert analysis["anomalyDetected"] is True
        assert analysis["probability"] > 0
        assert analysis["selectedStrategy"] == diagnosis.strategy
        assert analysis["actions"] == diagnosis.commands
        assert analysis["reasoningSteps"] == diagnosis.reasoning_steps

    def test_risk_level_critical_for_high_probability(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("radiation_level_usv_h", "critical"),
            make_event("signal_dbm", "warning"),
            make_event("cpu_temp_c", "warning"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        analysis = guardian.build_ai_analysis(diagnosis, anomalies)
        assert analysis["riskLevel"] == "critical"  # solar_storm probability 0.92


class TestCommandValidation:
    def test_duplicate_safe_mode_rejected(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        state.safe_mode = True
        cmd = {"type": "SAFE_MODE_ENABLE", "params": {}}
        safe = guardian._validate_commands([cmd], state)
        assert safe == []

    def test_thruster_low_battery_rejected(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        state.battery_percent = 10.0
        cmd = {"type": "MOMENTUM_DUMP", "params": {}}
        safe = guardian._validate_commands([cmd], state)
        assert safe == []

    def test_safe_commands_validated(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        cmd = {"type": "REDUCE_POWER_LOAD", "params": {"target_consumption_w": 100}}
        safe = guardian._validate_commands([cmd], state)
        assert len(safe) == 1
        assert safe[0]["validated"] is True

    def test_pipeline_commands_validated(self):
        guardian = AIGuardian()
        state = SpacecraftState()
        anomalies = [
            make_event("radiation_level_usv_h", "critical"),
            make_event("signal_dbm", "warning"),
        ]
        diagnosis = guardian.run_pipeline(anomalies, state)
        for cmd in diagnosis.commands:
            assert cmd.get("validated") is True