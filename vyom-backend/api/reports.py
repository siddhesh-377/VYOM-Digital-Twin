"""
VYOM Backend — Reports & PDF Generation API
"""
import time
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from core.loop import get_simulation

from core.database import get_db, Mission, BlackBoxEvent, TelemetryRecord, DailySummary, Incident, MissionRiskHistory, CrewHealthRecord, FarewellAssessment

router = APIRouter(prefix="/api/missions/{mission_id}/report", tags=["reports"])


@router.get("")
def get_mission_report(mission_id: str, db: Session = Depends(get_db)):
    """Get complete mission report as JSON."""
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(404, "Mission not found")

    sim = get_simulation(mission_id)

    # Black box events
    events = db.query(BlackBoxEvent).filter(BlackBoxEvent.mission_id == mission_id) \
        .order_by(BlackBoxEvent.timestamp.asc()).limit(5000).all()
    incidents = [e for e in events if e.severity in ["warning", "critical"]]
    ai_events = [e for e in events if e.event_type == "ai"]
    recovery_events = [e for e in events if e.event_type == "recovery"]

    # Telemetry stats
    telem_records = db.query(TelemetryRecord).filter(TelemetryRecord.mission_id == mission_id) \
        .order_by(TelemetryRecord.sim_timestamp.asc()).limit(10000).all()
    health_values = [r.data.get("overallHealth", 100) for r in telem_records if r.data]

    min_health = min(health_values) if health_values else 100.0
    max_health = max(health_values) if health_values else 100.0
    avg_health = sum(health_values) / len(health_values) if health_values else 100.0

    orbit_summary = {}
    if telem_records:
        last_telem = telem_records[-1].data if telem_records else {}
        orbit_summary = last_telem.get("orbit", {})

    # Live state if available
    overall_health = sim.state.overall_health if sim else m.overall_health
    mission_day = sim.mission_day if sim else m.mission_day
    objective_progress = sim.objective_progress if sim else m.objective_progress
    status = sim.status if sim else m.status

    # Commands
    commands_list = sim.cmd_engine.to_dict_list() if sim else []
    
    # ── v3.0 Data ──
    # Daily Summaries
    daily_summaries_db = db.query(DailySummary).filter(DailySummary.mission_id == mission_id).order_by(DailySummary.mission_day.asc()).all()
    daily_summaries = [s.summary_json for s in daily_summaries_db]
    
    # Incidents (v3.0 table)
    v3_incidents = db.query(Incident).filter(Incident.mission_id == mission_id).all()
    failure_analysis = []
    for inc in v3_incidents:
        failure_analysis.append({
            "incident_id": inc.id,
            "mission_day": inc.mission_day,
            "category": inc.normalized_fault_category,
            "subsystem": inc.normalized_subsystem,
            "resolution_time_ms": inc.total_resolution_ms,
            "recovery_mode": inc.recovery_mode,
            "status": inc.status
        })
        
    # Crew Health History
    crew_records = db.query(CrewHealthRecord).filter(CrewHealthRecord.mission_id == mission_id).order_by(CrewHealthRecord.timestamp.asc()).limit(1000).all()
    
    # Risk History
    risk_records = db.query(MissionRiskHistory).filter(MissionRiskHistory.mission_id == mission_id).order_by(MissionRiskHistory.timestamp.asc()).limit(1000).all()
    
    # Farewell Assessment
    farewell = db.query(FarewellAssessment).filter(FarewellAssessment.mission_id == mission_id).order_by(FarewellAssessment.timestamp.desc()).first()

    return {
        "mission_id": mission_id,
        "mission_name": m.name,
        "mission_type": m.mission_type,
        "destination": m.destination,
        "objective": m.objective,
        "budget_crore": m.budget_crore,
        "launch_site": m.launch_site or {},
        "status": status,
        "mission_day": round(mission_day, 4),
        "objective_progress": round(objective_progress, 2),
        "overall_health": round(overall_health, 2),
        "stats": {
            "total_events": len(events),
            "total_incidents": len(incidents),
            "ai_diagnoses": len(ai_events),
            "commands_executed": len([c for c in commands_list if c["status"] == "COMPLETE"]),
            "recovery_events": len(recovery_events),
            "min_health": round(min_health, 2),
            "max_health": round(max_health, 2),
            "avg_health": round(avg_health, 2),
            "telemetry_records": len(telem_records),
            "orbit_trail_points": len(sim.orbit_trail) if sim else 0,
        },
        "orbit_summary": orbit_summary,
        "telemetry_stats": {
            "min_health": round(min_health, 2),
            "max_health": round(max_health, 2),
            "avg_health": round(avg_health, 2),
            "records": len(telem_records),
        },
        "incidents": [
            {
                "id": e.id,
                "missionDay": round(e.mission_day, 4),
                "type": e.event_type,
                "severity": e.severity,
                "description": e.description,
                "source": e.source,
            }
            for e in incidents[-20:]  # last 20 incidents
        ],
        "ai_diagnoses": [
            {
                "id": e.id,
                "missionDay": round(e.mission_day, 4),
                "description": e.description,
            }
            for e in ai_events[-10:]
        ],
        "commands_executed": commands_list[:20],
        "recovery_events": [
            {
                "id": e.id,
                "missionDay": round(e.mission_day, 4),
                "description": e.description,
            }
            for e in recovery_events
        ],
        "crew_summary": m.crew_json or [],
        "generated_at": int(time.time() * 1000),
        # v3.0 Returns
        "mission_phase": m.mission_phase,
        "rul_days": m.rul_days,
        "daily_summaries": daily_summaries,
        "failure_analysis": failure_analysis,
        "risk_history": [{"day": r.mission_day, "score": r.risk_score} for r in risk_records],
        "crew_health_summary": [{"day": c.mission_day, "crew_id": c.crew_id, "fatigue": c.fatigue_index} for c in crew_records],
        "farewell_assessment": {
            "recommended": farewell.recommended_option if farewell else None,
            "rul": farewell.rul_days if farewell else None
        } if farewell else None
    }


@router.get("/pdf")
def get_mission_report_pdf(mission_id: str, db: Session = Depends(get_db)):
    """Generate and download a PDF mission report."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.colors import HexColor, white
    except ImportError:
        raise HTTPException(500, "reportlab not installed. Run: pip install reportlab")

    # Get report data
    report = get_mission_report(mission_id, db)

    buffer = io.BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 40

    # Background
    c.setFillColor(HexColor("#020409"))
    c.rect(0, 0, width, height, fill=1)

    # Header bar
    c.setFillColor(HexColor("#001830"))
    c.rect(0, height - 70, width, 70, fill=1)
    c.setStrokeColor(HexColor("#00d4ff"))
    c.setLineWidth(0.5)
    c.line(0, height - 70, width, height - 70)

    # VYOM Title
    c.setFillColor(HexColor("#00d4ff"))
    c.setFont("Helvetica-Bold", 24)
    c.drawString(margin, height - 40, "VYOM")
    c.setFont("Helvetica", 10)
    c.drawString(margin, height - 58, "OFFICIAL MISSION REPORT — SIMULATION")

    c.setFillColor(HexColor("#4488aa"))
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 38, f"Generated: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    c.drawRightString(width - margin, height - 52, f"Mode: SIMULATION")

    y = height - 90

    def section(title: str, color: str = "#00d4ff"):
        nonlocal y
        c.setStrokeColor(HexColor(color))
        c.line(margin, y, width - margin, y)
        y -= 14
        c.setFillColor(HexColor(color))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, title)
        y -= 14

    def row(label: str, value: str):
        nonlocal y
        c.setFillColor(HexColor("#6699aa"))
        c.setFont("Helvetica", 9)
        c.drawString(margin + 4, y, label + ":")
        c.setFillColor(HexColor("#ddeeff"))
        c.drawString(margin + 140, y, str(value)[:60])
        y -= 11

    def check_page():
        nonlocal y
        if y < 80:
            c.showPage()
            c.setFillColor(HexColor("#020409"))
            c.rect(0, 0, width, height, fill=1)
            y = height - margin

    # 01 Mission Profile
    section("01 · MISSION PROFILE")
    row("Mission Name", report["mission_name"])
    row("Mission Class", report["mission_type"].upper())
    row("Destination", report["destination"].upper().replace("-", " "))
    row("Objective", report["objective"][:60])
    row("Budget", f"₹{report['budget_crore']} Crore INR")
    row("Launch Site", report["launch_site"].get("name", "N/A"))
    row("Agency", report["launch_site"].get("agency", "N/A"))
    row("Mission Day", str(round(report["mission_day"], 2)))
    row("Phase", report.get("mission_phase", "unknown").upper())
    row("Status", report["status"].upper())
    if report.get("rul_days"):
        row("RUL Estimate", f"{round(report['rul_days'], 1)} days")
    y -= 8

    # 02 Performance Stats
    check_page()
    section("02 · MISSION PERFORMANCE")
    stats = report["stats"]
    row("Objective Progress", f"{report['objective_progress']}%")
    row("Overall Health", f"{report['overall_health']}%")
    row("Min Health", f"{stats['min_health']}%")
    row("Max Health", f"{stats['max_health']}%")
    row("Avg Health", f"{stats['avg_health']}%")
    row("Total Events", str(stats["total_events"]))
    row("Incidents", str(stats["total_incidents"]))
    row("AI Diagnoses", str(stats["ai_diagnoses"]))
    row("Commands Executed", str(stats["commands_executed"]))
    row("Recovery Events", str(stats["recovery_events"]))
    y -= 8

    # 03 Incidents
    check_page()
    section("03 · INCIDENTS & THREATS", "#ff8c00")
    if report["failure_analysis"]:
        for inc in report["failure_analysis"][:10]:
            check_page()
            c.setFillColor(HexColor("#ff2d55" if inc["status"] != "resolved" else "#ff8c00"))
            c.setFont("Helvetica-Bold", 8)
            res_str = f"{inc['resolution_time_ms']/1000:.1f}s" if inc['resolution_time_ms'] else "pending"
            c.drawString(margin + 4, y, f"[{inc['status'].upper()}] Day {inc['mission_day']:.2f}")
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 120, y, f"{inc['subsystem']}: {inc['category']} (Mode: {inc['recovery_mode']}) [Res: {res_str}]")
            y -= 10
    elif report["incidents"]:
        for inc in report["incidents"][:10]:
            check_page()
            c.setFillColor(HexColor("#ff2d55" if inc["severity"] == "critical" else "#ff8c00"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(margin + 4, y, f"[{inc['severity'].upper()}] Day {inc['missionDay']:.2f}")
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 140, y, inc["description"][:70])
            y -= 10
    else:
        row("Result", "No incidents recorded — nominal mission")
    y -= 8

    # 04 Daily Analysis
    if report.get("daily_summaries"):
        check_page()
        section("04 · DAILY ANALYSIS", "#00d4ff")
        for summary in report["daily_summaries"][-10:]:  # show last 10 days
            check_page()
            day = summary.get("mission_state", {}).get("mission_day", 0)
            health = summary.get("mission_state", {}).get("health_avg", 100)
            c.setFillColor(HexColor("#00d4ff"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(margin + 4, y, f"Day {day}")
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 100, y, f"Avg Health: {health:.1f}% | Env: {summary.get('environment', {}).get('classification', 'nominal')}")
            y -= 10
        y -= 8

    # 05 Crew (if human)
    if report["crew_summary"]:
        check_page()
        section("05 · CREW COMPLEMENT (ANONYMIZED)", "#00ff88")
        for i, crew in enumerate(report["crew_summary"]):
            check_page()
            c.setFillColor(HexColor("#ddeeff"))
            c.setFont("Helvetica-Bold", 9)
            # ANONYMIZE: Do not output name, only role or ID
            role = crew.get('role', f"Crew Member {i+1}")
            c.drawString(margin + 4, y, f"[{role.upper()}]")
            c.setFillColor(HexColor("#8899aa"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 140, y,
                         f"Status: {crew.get('status','')} | Data: SIMULATED/ESTIMATED")
            y -= 10

    # 06 Farewell
    if report.get("farewell_assessment"):
        check_page()
        section("06 · FAREWELL ASSESSMENT", "#ff2d55")
        fw = report["farewell_assessment"]
        if fw.get("recommended"):
            row("Recommended Action", fw["recommended"])
        if fw.get("rul"):
            row("Estimated RUL", f"{round(fw['rul'], 1)} days")

    c.save()
    buffer.seek(0)

    filename = f"VYOM_Report_{mission_id}_{int(time.time())}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
