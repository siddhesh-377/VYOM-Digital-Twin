"""API-level tests using the FastAPI TestClient against a temp SQLite DB."""
import pytest
from fastapi.testclient import TestClient

from main import app
from simulation.loop import _simulations


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mission_id(client):
    resp = client.post("/api/missions", json={"name": "API Test Mission"})
    assert resp.status_code == 201
    data = resp.json()
    _simulations[data["id"]]  # ensure sim registered
    return data["id"]


class TestHealth:
    def test_health_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "operational"

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["service"] == "VYOM Mission Digital Twin Backend"


class TestMissions:
    def test_create_mission(self, client):
        resp = client.post("/api/missions", json={"name": "Alpha"})
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Alpha"
        assert body["status"] == "configuring"
        assert body["id"].startswith("VYOM-")

    def test_create_mission_with_explicit_id(self, client):
        resp = client.post("/api/missions", json={"id": "M-ALPHA", "name": "Alpha"})
        assert resp.status_code == 201
        assert resp.json()["id"] == "M-ALPHA"

    def test_create_duplicate_id_returns_existing(self, client):
        client.post("/api/missions", json={"id": "M-DUP", "name": "One"})
        resp = client.post("/api/missions", json={"id": "M-DUP", "name": "Two"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "One"

    def test_list_missions(self, client, mission_id):
        resp = client.get("/api/missions")
        assert resp.status_code == 200
        ids = [m["id"] for m in resp.json()]
        assert mission_id in ids

    def test_get_mission(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == mission_id

    def test_get_mission_404(self, client):
        assert client.get("/api/missions/NOPE").status_code == 404

    def test_mission_validation(self, client):
        assert client.post("/api/missions", json={}).status_code == 422
        assert client.post("/api/missions", json={"name": ""}).status_code == 422

    def test_pause_mission(self, client, mission_id):
        resp = client.post(f"/api/missions/{mission_id}/pause")
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    def test_resume_mission(self, client, mission_id):
        client.post(f"/api/missions/{mission_id}/pause")
        resp = client.post(f"/api/missions/{mission_id}/resume")
        assert resp.status_code == 200
        assert resp.json()["status"] == "resumed"

    def test_reset_mission(self, client, mission_id):
        resp = client.post(f"/api/missions/{mission_id}/reset")
        assert resp.status_code == 200
        assert resp.json()["status"] == "reset"

    def test_set_warp(self, client, mission_id):
        resp = client.patch(f"/api/missions/{mission_id}/warp?multiplier=100")
        assert resp.status_code == 200
        assert resp.json()["time_multiplier"] == 100

    def test_set_warp_missing_sim(self, client):
        resp = client.patch("/api/missions/NO-SIM/warp?multiplier=5")
        # mission doesn't exist -> 404
        assert resp.status_code == 404


class TestFaults:
    def test_inject_fault(self, client, mission_id):
        resp = client.post(
            f"/api/missions/{mission_id}/faults",
            json={"fault_type": "solar_storm", "severity": 8.0},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["fault_type"] == "solar_storm"
        assert body["active"] is True

    def test_inject_fault_via_alias(self, client, mission_id):
        resp = client.post(
            f"/api/missions/{mission_id}/faults",
            json={"fault_type": "thruster-leak"},
        )
        assert resp.status_code == 201
        assert resp.json()["fault_type"] == "propulsion_anomaly"

    def test_inject_unknown_fault_400(self, client, mission_id):
        resp = client.post(
            f"/api/missions/{mission_id}/faults",
            json={"fault_type": "nonsense_fault"},
        )
        assert resp.status_code == 400

    def test_inject_fault_missing_mission(self, client):
        resp = client.post(
            "/api/missions/NOPE/faults",
            json={"fault_type": "solar_storm"},
        )
        assert resp.status_code == 404

    def test_list_faults(self, client, mission_id):
        client.post(f"/api/missions/{mission_id}/faults", json={"fault_type": "solar_storm"})
        resp = client.get(f"/api/missions/{mission_id}/faults")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_mitigate_fault(self, client, mission_id):
        inj = client.post(
            f"/api/missions/{mission_id}/faults",
            json={"fault_type": "solar_storm"},
        )
        fault_id = inj.json()["id"]
        resp = client.delete(f"/api/missions/{mission_id}/faults/{fault_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "mitigated"

    def test_mitigate_unknown_fault_404(self, client, mission_id):
        resp = client.delete(f"/api/missions/{mission_id}/faults/nope")
        assert resp.status_code == 404


class TestTelemetry:
    def test_latest_telemetry(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/telemetry")
        assert resp.status_code == 200
        body = resp.json()
        for section in ["power", "thermal", "attitude", "comm", "compute", "orbit"]:
            assert section in body

    def test_telemetry_missing_sim_404(self, client):
        resp = client.get("/api/missions/NOPE/telemetry")
        assert resp.status_code == 404

    def test_telemetry_history_empty(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/telemetry/history")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_orbit_trajectory_empty(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/telemetry/orbit/trajectory")
        assert resp.status_code == 200
        assert resp.json() == []


class TestBlackBox:
    def test_blackbox_records_fault_injection(self, client, mission_id):
        client.post(f"/api/missions/{mission_id}/faults", json={"fault_type": "solar_storm"})
        resp = client.get(f"/api/missions/{mission_id}/blackbox")
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 1
        assert any("FAULT INJECTED" in e["description"] for e in events)

    def test_blackbox_empty_for_fresh_mission(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/blackbox")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_blackbox_export(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/blackbox/export")
        assert resp.status_code == 200
        body = resp.json()
        assert body["mission_id"] == mission_id
        assert "total_events" in body


class TestCommands:
    def test_submit_command_validated(self, client, mission_id):
        resp = client.post(
            f"/api/missions/{mission_id}/commands",
            json={"command_type": "REDUCE_POWER_LOAD", "params": {"target_consumption_w": 100}},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "VALIDATED"

    def test_submit_command_rejected(self, client, mission_id):
        # Get sim and force battery low
        from simulation.loop import get_simulation
        get_simulation(mission_id).state.battery_percent = 5.0
        resp = client.post(
            f"/api/missions/{mission_id}/commands",
            json={"command_type": "THRUSTER_ASSIST_MODE", "params": {}},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "REJECTED"

    def test_submit_command_missing_sim(self, client):
        resp = client.post(
            "/api/missions/NOPE/commands",
            json={"command_type": "SAFE_MODE_ENABLE", "params": {}},
        )
        assert resp.status_code == 404

    def test_list_commands(self, client, mission_id):
        client.post(f"/api/missions/{mission_id}/commands", json={"command_type": "REDUCE_POWER_LOAD"})
        resp = client.get(f"/api/missions/{mission_id}/commands")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_command(self, client, mission_id):
        submit = client.post(
            f"/api/missions/{mission_id}/commands",
            json={"command_type": "REDUCE_POWER_LOAD"},
        )
        cmd_id = submit.json()["id"]
        resp = client.get(f"/api/missions/{mission_id}/commands/{cmd_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == cmd_id


class TestReports:
    def test_report(self, client, mission_id):
        resp = client.get(f"/api/missions/{mission_id}/report")
        assert resp.status_code == 200
        body = resp.json()
        assert body["mission_id"] == mission_id
        assert "stats" in body
        assert "incidents" in body

    def test_report_missing_mission_404(self, client):
        assert client.get("/api/missions/NOPE/report").status_code == 404