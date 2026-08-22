"""
VYOM Backend — Reports & PDF Generation API
"""
import time
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from simulation.loop import get_simulation

from core.database import get_db, Mission
from core.report_builder import build_mission_report

router = APIRouter(prefix="/api/missions/{mission_id}/report", tags=["reports"])


@router.get("")
def get_mission_report(mission_id: str, db: Session = Depends(get_db)):
    """Get complete mission report as JSON, built from the authoritative event database."""
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(404, "Mission not found")

    sim = get_simulation(mission_id)
    return build_mission_report(db, m, sim)


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
            res_ms = inc.get("total_resolution_ms")
            res_str = f"{res_ms/1000:.1f}s" if res_ms else "pending"
            c.drawString(margin + 4, y, f"[{inc['status'].upper()}] Day {inc['mission_day']:.2f}")
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 120, y, f"{inc['normalized_subsystem']}: {inc['normalized_category']} "
                                          f"(Mode: {inc['recovery_mode']}) [Res: {res_str}]")
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

    # 04 Daily Analysis (Day 0 → final day)
    if report.get("daily_analysis"):
        check_page()
        section("04 · DAILY ANALYSIS (DAY 0 TO FINAL DAY)", "#00d4ff")
        for entry in report["daily_analysis"][-15:]:
            check_page()
            day = entry.get("mission_day", 0)
            health = (entry.get("mission_state") or {}).get("health_avg", 100)
            env_cls = (entry.get("environment") or {}).get("classification", "nominal")
            n_ev = entry.get("event_count", 0)
            c.setFillColor(HexColor("#00d4ff"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(margin + 4, y, f"Day {day}")
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 100, y,
                         f"Avg Health: {health:.1f}% | Env: {env_cls} | Events: {n_ev}")
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

    # 06 Recovery-Time Analysis (AI vs Manual)
    rta = report.get("recovery_time_analysis") or {}
    if rta.get("averages"):
        check_page()
        section("06 · RECOVERY-TIME ANALYSIS (AI VS MANUAL)", "#9b5de5")
        avgs = rta["averages"]
        if avgs.get("ai_total_resolution_ms") is not None:
            row("Avg AI Resolution", f"{avgs['ai_total_resolution_ms']/1000:.1f}s ({avgs.get('resolved_count', 0)} resolved)")
        else:
            row("Avg AI Resolution", "No AI-resolved incidents")
        if avgs.get("manual_total_resolution_ms") is not None:
            row("Avg Manual Resolution", f"{avgs['manual_total_resolution_ms']/1000:.1f}s")
        else:
            row("Avg Manual Resolution", "No manually-resolved incidents")
        y -= 8

    # 07 Mission Risk
    mra = report.get("mission_risk_analysis") or {}
    if mra.get("history"):
        check_page()
        section("07 · MISSION RISK HISTORY", "#ff8c00")
        hist = mra["history"]
        for pt in hist[-8:]:
            check_page()
            c.setFillColor(HexColor("#ccddee"))
            c.setFont("Helvetica", 8)
            c.drawString(margin + 4, y,
                         f"Day {pt['mission_day']:.2f}: {pt['risk_score']:.1f} ({pt.get('risk_category', '—')}) trend: {pt.get('trend', '—')}")
            y -= 10
        y -= 8

    # 08 End-of-Mission / Farewell
    eom = report.get("end_of_mission_analysis")
    if eom:
        check_page()
        section("08 · END-OF-MISSION ASSESSMENT", "#ff2d55")
        if eom.get("recommended_option"):
            row("Recommended Action", eom["recommended_option"])
        if eom.get("spacecraft_health") is not None:
            row("Spacecraft Health", f"{eom['spacecraft_health']:.1f}%")
        mc = eom.get("monte_carlo_results") or {}
        if mc.get("success_rate") is not None:
            row("MC Success Rate", f"{mc['success_rate']*100:.1f}% ({mc.get('runs_completed')} runs)")
        row("Note", "Simulation estimate — not real-world guarantee")

    c.save()
    buffer.seek(0)

    filename = f"VYOM_Report_{mission_id}_{int(time.time())}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
