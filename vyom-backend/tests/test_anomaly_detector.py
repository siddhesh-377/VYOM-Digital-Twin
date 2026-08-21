"""Tests for the anomaly detection engine (5 strategies)."""
import time
import uuid

from engines.anomaly_detector import AnomalyDetector, AnomalyEvent, PERSISTENCE_TICKS
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


class TestThresholdDetection:
    def test_high_threshold_critical(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 90.0  # critical at >= 82
        anomalies = det.detect(state, 0.1)
        cpu = [a for a in anomalies if a.channel == "cpu_temp_c"]
        assert cpu
        assert cpu[0].severity == "critical"

    def test_high_threshold_warning(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 72.0  # warning at >= 70
        anomalies = det.detect(state, 0.1)
        cpu = [a for a in anomalies if a.channel == "cpu_temp_c"]
        assert cpu
        assert cpu[0].severity == "warning"

    def test_low_threshold_critical(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.battery_percent = 10.0  # critical at <= 15
        anomalies = det.detect(state, 0.1)
        bat = [a for a in anomalies if a.channel == "battery_percent"]
        assert bat
        assert bat[0].severity == "critical"

    def test_low_threshold_warning(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.battery_percent = 20.0  # warning at <= 25
        anomalies = det.detect(state, 0.1)
        bat = [a for a in anomalies if a.channel == "battery_percent"]
        assert bat
        assert bat[0].severity == "warning"

    def test_nominal_no_anomaly(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        anomalies = det.detect(state, 0.1)
        assert anomalies == []

    def test_subsystem_mapping(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.signal_dbm = -120.0
        anomalies = det.detect(state, 0.1)
        sig = [a for a in anomalies if a.channel == "signal_dbm"]
        assert sig
        assert sig[0].subsystem == "Communications"


class TestRateOfChange:
    def test_roc_critical(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        det.detect(state, 0.1)  # baseline
        state.cpu_temp_c = 90.0  # huge jump
        anomalies = det.detect(state, 2.0)
        roc = [a for a in anomalies if a.channel == "cpu_temp_c_roc"]
        assert roc
        assert roc[0].severity == "critical"
        assert roc[0].detection_strategy == "rate_of_change"


class TestPersistence:
    def test_persistence_after_enough_ticks(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 90.0
        for _ in range(PERSISTENCE_TICKS["warning"]):
            anomalies = det.detect(state, 0.1)
        persist = [a for a in anomalies if a.channel == "cpu_temp_c_persist"]
        assert persist
        assert persist[0].detection_strategy == "persistence"

    def test_persistence_resets_when_in_band(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 90.0
        for _ in range(PERSISTENCE_TICKS["warning"] - 1):
            det.detect(state, 0.1)
        state.cpu_temp_c = 41.0  # back in band
        anomalies = det.detect(state, 0.1)
        persist = [a for a in anomalies if a.channel == "cpu_temp_c_persist"]
        assert persist == []


class TestMultivariate:
    def test_power_balance(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.power_consumption_w = 400.0
        state.solar_generation_w = 100.0
        state.battery_percent = 50.0
        state.in_eclipse = False
        anomalies = det.detect(state, 0.1)
        pb = [a for a in anomalies if a.channel == "power_balance"]
        assert pb
        assert pb[0].detection_strategy == "multivariate"

    def test_thermal_cpu_consistency(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 80.0
        state.cpu_percent = 10.0
        anomalies = det.detect(state, 0.1)
        tc = [a for a in anomalies if a.channel == "thermal_cpu_consistency"]
        assert tc


class TestDeduplication:
    def test_channel_dedup_keeps_highest_severity(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 90.0  # triggers threshold + persistence(1st tick)
        anomalies = det.detect(state, 0.1)
        channels = [a.channel for a in anomalies]
        # persistence only fires after N ticks, so expect a single cpu_temp_c entry
        assert channels.count("cpu_temp_c") <= 1

    def test_active_anomalies_cached(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        state.cpu_temp_c = 90.0
        det.detect(state, 0.1)
        assert det.active_anomalies


class TestStatistical:
    def test_statistical_detection_after_window(self):
        det = AnomalyDetector()
        state = SpacecraftState()
        # Steady baseline
        for _ in range(20):
            state.cpu_temp_c = 41.0
            det.detect(state, 0.1)
        # Outlier
        state.cpu_temp_c = 80.0
        anomalies = det.detect(state, 0.1)
        stat = [a for a in anomalies if a.channel == "cpu_temp_c_stat"]
        assert stat
        assert stat[0].detection_strategy == "statistical"