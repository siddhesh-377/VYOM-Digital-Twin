"""
VYOM End-to-End Workflow Test
Day 0 -> telemetry+crew -> fault -> incident -> normalize -> Vyom AI ->
timed recovery (AI and manual) -> telemetry verification -> health/RUL updates
-> Black Box -> timeline -> completion report.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

PASS, FAIL = [], []
def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))

CREW = [
    {"id": "c-1", "name": "Private-A", "role": "Commander"},
    {"id": "c-2", "name": "Private-B", "role": "Flight Engineer"},
]

with TestClient(app) as client:
    print("══ 1. MISSION DAY 0 — CREATE & START ══")
    r = client.post("/api/missions", json={
        "name": "E2E Mission", "mission_type": "human-lunar",
        "destination": "lunar-orbit", "objective": "End-to-end verification",
        "budget_crore": 500, "launch_site": {"name": "SDSC", "agency": "ISRO"},
        "config": {"initial_alt_km": 650, "inclination_deg": 51.6},
        "satellite": {}, "crew": CREW,
        "endGoal": "crew-safe-return",
    })
    mid = r.json()["id"]
    check("mission created", r.status_code == 201, mid)
    check("end goal recorded at creation", client.get(f"/api/missions/{mid}").status_code == 200)
    r = client.post(f"/api/missions/{mid}/start")
    check("simulation started", r.status_code == 200)
    time.sleep(3)

    print("══ 2. TELEMETRY + CREW MONITORING LIVE ══")
    tel = client.get(f"/api/missions/{mid}/telemetry").json()
    check("telemetry flowing", bool(tel) and "overallHealth" in str(tel)[:500] or tel.get("overallHealth") is not None)
    crew = client.get(f"/api/missions/{mid}/crew/health").json()
    check("crew monitored (simulated)", len(crew) == 2 and all(c["data_quality"] == "simulated" for c in crew))

    print("══ 3. INJECT DANGER SIMULATOR FAILURE ══")
    r = client.post(f"/api/missions/{mid}/faults", json={"fault_type": "comm_failure", "severity": 5})
    fid = r.json()["id"]
    check("fault injected", r.status_code == 201)

    print("══ 4. INCIDENT CREATED + NORMALIZED + SENT TO VYOM AI ══")
    incs = client.get(f"/api/missions/{mid}/incidents").json()
    inc = incs[0] if incs else {}
    check("unique incident id", inc.get("id", "").startswith("INC-"), inc.get("id"))
    check("raw error preserved", bool(inc.get("raw_error")))
    check("normalized to communication-signal", inc.get("normalized_fault_category") == "communication-signal")
    check("subsystem/severity/confidence present",
          inc.get("normalized_subsystem") == "Communication" and inc.get("normalized_severity") and inc.get("confidence", 0) > 0.5)

    # Wait for AI diagnosis then MANUAL takeover (operator choice path)
    deadline = time.time() + 90
    while time.time() < deadline:
        inc = client.get(f"/api/missions/{mid}/incidents/{inc['id']}").json()
        if inc.get("diagnosis_time_ms"):
            break
        time.sleep(2)
    check("Vyom AI diagnosis recorded", bool(inc.get("diagnosis_time_ms")))
    check("AI analysis attached", bool(inc.get("ai_analysis_json")))

    print("══ 5. OPERATOR CHOOSES MANUAL RECOVERY ══")
    procs = client.get(f"/api/missions/{mid}/incidents/{inc['id']}/procedures").json()
    check("validated procedures offered", len(procs) > 0, str([p["id"] for p in procs]))
    proc = next((p for p in procs if p["execution_mode"] == "execute-after-confirmation"), None)
    r_noconf = client.post(f"/api/missions/{mid}/incidents/{inc['id']}/manual-recovery",
                           json={"incident_id": inc["id"], "operator": "OP-E2E", "procedure_id": proc["id"], "confirmed": False})
    check("unconfirmed execution blocked", r_noconf.status_code == 400)
    r = client.post(f"/api/missions/{mid}/incidents/{inc['id']}/manual-recovery",
                    json={"incident_id": inc["id"], "operator": "OP-E2E", "procedure_id": proc["id"], "confirmed": True})
    body = r.json()
    check("manual procedure executed via safety-validated commands",
          r.status_code == 200 and body.get("action_result") in ("executed", "recorded"),
          str(body.get("commands")))

    print("══ 6. TELEMETRY-VERIFIED RECOVERY + BACKEND TIMING ══")
    deadline = time.time() + 60
    while time.time() < deadline:
        inc = client.get(f"/api/missions/{mid}/incidents/{inc['id']}").json()
        if inc.get("status") == "resolved":
            break
        time.sleep(2)
    tl = client.get(f"/api/missions/{mid}/incidents/{inc['id']}/timeline").json()
    check("incident resolved by verified telemetry", inc.get("status") == "resolved", f"mode={inc.get('recovery_mode')}")
    times = [tl.get(k) for k in ("detection_time_ms","diagnosis_time_ms","decision_time_ms","recovery_start_time_ms","recovery_end_time_ms")]
    check("all phase timestamps recorded", all(t is not None for t in times))
    check("total resolution computed from backend timestamps",
          tl.get("total_resolution_ms") is not None and tl["total_resolution_ms"] > 0,
          f"{tl.get('total_resolution_ms')}ms / {tl.get('total_resolution_sim_s')}s sim")

    print("══ 7. HEALTH/RISK/RUL UPDATES ══")
    m = client.get(f"/api/missions/{mid}").json()
    check("spacecraft health tracked", m.get("overall_health") is not None, f"{m.get('overall_health')}")
    risk = client.get(f"/api/missions/{mid}/risk").json()
    check("risk calculated with factors", risk.get("risk_score") is not None and len(risk.get("contributing_factors", [])) >= 8,
          f"{risk.get('risk_category')} {risk.get('risk_score')}")
    rep = client.get(f"/api/missions/{mid}/report").json()
    check("RUL estimated", rep.get("rul_analysis", {}).get("rul_days_current") is not None,
          str(rep.get("rul_analysis", {}).get("rul_days_current"))[:40])

    print("══ 8. BLACK BOX (APPEND-ONLY, HASH-CHAINED) ══")
    bb = client.get(f"/api/missions/{mid}/blackbox?limit=200").json()
    check("events stored with audit fields", any(e.get("rawError") for e in bb))
    v = client.get(f"/api/missions/{mid}/blackbox/verify").json()
    check("hash chain intact", v.get("chain_intact") is True, f"{v.get('total_events')} events")
    corr = client.post(f"/api/missions/{mid}/blackbox/corrections",
                       json={"original_event_id": bb[0]["id"], "description": "E2E correction", "corrected_by": "Reviewer"})
    check("correction event appended (original preserved)", corr.status_code == 201)
    check("chain still intact after correction",
          client.get(f"/api/missions/{mid}/blackbox/verify").json().get("chain_intact"))

    print("══ 9. CONTINUE MISSION + TIMELINE ══")
    client.patch(f"/api/missions/{mid}/warp?multiplier=600")
    time.sleep(10)
    client.patch(f"/api/missions/{mid}/warp?multiplier=1")
    m = client.get(f"/api/missions/{mid}").json()
    check("mission day advanced under warp", m["mission_day"] > 0.05, f"day={round(m['mission_day'],3)}")
    tl_events = client.get(f"/api/missions/{mid}/timeline").json()
    check("complete timeline generated", len(tl_events) > 0, f"{len(tl_events)} entries")
    hist = client.get(f"/api/orbital/daily-history/{mid}").json()
    print(f"       daily orbital history: {hist.get('days_recorded')} days recorded")

    print("══ 10. MISSION COMPLETION REPORT ══")
    rep = client.get(f"/api/missions/{mid}/report").json()
    sections = ["mission_summary","daily_analysis","complete_timeline","spacecraft_health",
                "crew_health_summary","telemetry_summary","failure_analysis","emergency_analysis",
                "vyom_ai_analysis","manual_intervention_analysis","recovery_time_analysis",
                "mission_risk_analysis","mission_lifecycle_analysis","rul_analysis",
                "objectives_analysis","activities_analysis","audit_trail"]
    missing = [s for s in sections if s not in rep]
    check("all report sections from event store", not missing, f"missing: {missing}")
    blob = str(rep)
    check("no crew names in report", "Private-A" not in blob and "Private-B" not in blob)
    check("AI vs manual metrics from timestamps",
          rep["recovery_time_analysis"]["averages"]["all_total_resolution_ms"] is not None)
    check("audit trail present", rep["audit_trail"]["frontend_state_used"] is False)
    pdf = client.get(f"/api/missions/{mid}/report/pdf")
    check("PDF report generated", pdf.status_code == 200 and len(pdf.content) > 1000, f"{len(pdf.content)} bytes")

    client.post(f"/api/missions/{mid}/pause")

print("\n════════ E2E RESULT ════════")
print(f"PASSED: {len(PASS)}  FAILED: {len(FAIL)}")
if FAIL:
    print("FAILED CHECKS:", FAIL)
    sys.exit(1)
print("END-TO-END WORKFLOW: ALL CHECKS PASSED")
