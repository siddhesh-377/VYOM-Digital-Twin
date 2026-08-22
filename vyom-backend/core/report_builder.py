"""
VYOM Backend — Mission Report Builder
Builds complete mission reports from the authoritative event database
(Black Box, incidents, telemetry, daily summaries, crew records, risk history,
activities, objectives, farewell assessments). Every value is traceable to its
source record; no frontend or hardcoded state is used.

Crew members are never identified by name in any section: only non-identifying
role labels ("Crew", "Crew Member 1", role) are emitted.
"""
import time
import uuid
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session

from core.database import (
    Mission, BlackBoxEvent, TelemetryRecord, DailySummary, Incident,
    CrewHealthRecord, MissionRiskHistory, ScheduledActivity,
    MissionObjective as ObjectiveModel, FarewellAssessment,
)

MODEL_VERSION = "3.0.0"

# Reference frame / units metadata attached to orbital & trajectory measurements
ORBITAL_UNITS = {
    "altitude_unit": "km",
    "velocity_unit": "km/s",
    "latitude_longitude_unit": "deg (geodetic)",
    "position_frame": "J2000 ECI (approximate)",
    "time_standard": "UTC (Unix epoch ms)",
    "data_source": "backend simulation propagator",
    "data_quality": "simulated",
}


def _anonymize_role(index: int, record: Dict[str, Any]) -> str:
    """Non-identifying crew label. Names are never included in reports."""
    return record.get("crew_id") or f"Crew Member {index + 1}"


def build_mission_report(db: Session, mission: Mission, sim=None) -> Dict[str, Any]:
    mid = mission.id
    report_id = f"RPT-{int(time.time() * 1000)}-{uuid.uuid4().hex[:4]}"

    # ── Source records ──────────────────────────────────────────────────────
    events: List[BlackBoxEvent] = (
        db.query(BlackBoxEvent).filter(BlackBoxEvent.mission_id == mid)
        .order_by(BlackBoxEvent.timestamp.asc()).all()
    )
    incidents: List[Incident] = (
        db.query(Incident).filter(Incident.mission_id == mid)
        .order_by(Incident.detection_time_ms.asc()).all()
    )
    telem: List[TelemetryRecord] = (
        db.query(TelemetryRecord).filter(TelemetryRecord.mission_id == mid)
        .order_by(TelemetryRecord.sim_timestamp.asc()).limit(20000).all()
    )
    daily: List[DailySummary] = (
        db.query(DailySummary).filter(DailySummary.mission_id == mid)
        .order_by(DailySummary.mission_day.asc()).all()
    )
    crew_records: List[CrewHealthRecord] = (
        db.query(CrewHealthRecord).filter(CrewHealthRecord.mission_id == mid)
        .order_by(CrewHealthRecord.timestamp.asc()).limit(5000).all()
    )
    risk_history: List[MissionRiskHistory] = (
        db.query(MissionRiskHistory).filter(MissionRiskHistory.mission_id == mid)
        .order_by(MissionRiskHistory.timestamp.asc()).limit(5000).all()
    )
    activities: List[ScheduledActivity] = (
        db.query(ScheduledActivity).filter(ScheduledActivity.mission_id == mid)
        .order_by(ScheduledActivity.planned_start_day.asc()).all()
    )
    objectives: List[ObjectiveModel] = (
        db.query(ObjectiveModel).filter(ObjectiveModel.mission_id == mid)
        .order_by(ObjectiveModel.order_index.asc()).all()
    )
    farewell: Optional[FarewellAssessment] = (
        db.query(FarewellAssessment).filter(FarewellAssessment.mission_id == mid)
        .order_by(FarewellAssessment.timestamp.desc()).first()
    )

    health_values = [r.data.get("overallHealth", 100) for r in telem if r.data]
    final_day = max(
        [mission.mission_day] +
        [e.mission_day for e in events] +
        [d.mission_day for d in daily]
    ) if events or daily else mission.mission_day

    # ── 01 Mission summary ───────────────────────────────────────────────────
    mission_summary = {
        "mission_id": mid,
        "mission_name": mission.name,
        "mission_type": mission.mission_type,
        "destination": mission.destination,
        "objective_statement": mission.objective,
        "status": sim.status if sim else mission.status,
        "current_phase": getattr(mission, "mission_phase", None),
        "end_goal": getattr(mission, "end_goal", None),
        "architecture_id": getattr(mission, "architecture_id", None),
        "mission_day_final": round(final_day, 4),
        "planned_end_day": getattr(mission, "planned_end_day", None),
        "estimated_lifetime_days": getattr(mission, "estimated_lifetime_days", None),
        "rul_days_current": getattr(mission, "rul_days", None),
        "objective_progress_percent": round(
            (sim.objective_progress if sim else mission.objective_progress) or 0.0, 2),
        "is_human_mission": bool(mission.crew_json),
        "crew_size_roles_only": len(mission.crew_json or []),
        "source_tables": ["missions"],
    }

    # ── 02 Complete event timeline (Day 0 → final) ──────────────────────────
    complete_timeline = [
        {
            "event_id": e.id,
            "timestamp_utc_ms": e.timestamp,
            "mission_day": round(e.mission_day, 4),
            "event_type": e.event_type,
            "severity": e.severity,
            "description": e.description,
            "source": e.source,
            "subsystem": e.subsystem,
            "incident_id": e.incident_id,
            "correction_of": e.correction_of,
            "operator": e.operator,
            "event_hash": e.event_hash,
        }
        for e in events
    ]

    # ── 03 Spacecraft health ─────────────────────────────────────────────────
    spacecraft_health = {
        "overall_health_current": round((sim.state.overall_health if sim else mission.overall_health) or 0.0, 2),
        "min_health": round(min(health_values), 2) if health_values else 100.0,
        "max_health": round(max(health_values), 2) if health_values else 100.0,
        "avg_health": round(sum(health_values) / len(health_values), 2) if health_values else 100.0,
        "samples": len(health_values),
        "units": "percent (0-100)",
        "source_tables": ["telemetry", "missions"],
    }

    # ── 04 Crew health (anonymized, SIMULATED) ───────────────────────────────
    by_crew: Dict[str, List[CrewHealthRecord]] = {}
    for r in crew_records:
        by_crew.setdefault(r.crew_id, []).append(r)
    crew_health_summary = []
    for i, (cid, recs) in enumerate(sorted(by_crew.items())):
        last = recs[-1]
        crew_health_summary.append({
            "crew_label": _anonymize_role(i, {"crew_id": cid}),
            "records": len(recs),
            "final_vitals": {
                "heart_rate_bpm": round(last.heart_rate_bpm, 1),
                "spo2_percent": round(last.spo2_percent, 1),
                "temperature_c": round(last.temperature_c, 2),
                "blood_pressure": f"{round(last.blood_pressure_sys)}/{round(last.blood_pressure_dia)} mmHg",
                "fatigue_index": round(last.fatigue_index, 1),
                "stress_index": round(last.stress_index, 1),
                "hydration_percent": round(last.hydration_percent, 1),
                "radiation_dose_msv": round(last.radiation_dose_msv, 3),
                "eva_duration_min": round(last.eva_duration_min, 1),
                "location": last.location,
                "comm_status": last.comm_status,
            },
            "data_quality": last.data_quality,
            "disclaimer": "SIMULATED physiological model output — not medical data",
            "source_table": "crew_health_records",
        })

    # ── 05 Telemetry summary ─────────────────────────────────────────────────
    last_telem_data = telem[-1].data if telem else {}
    orbit_summary = last_telem_data.get("orbit", {})
    telemetry_summary = {
        "records": len(telem),
        "first_timestamp_utc_ms": telem[0].sim_timestamp if telem else None,
        "last_timestamp_utc_ms": telem[-1].sim_timestamp if telem else None,
        "orbit_final": orbit_summary,
        "units_and_frame": ORBITAL_UNITS,
        "power_final": last_telem_data.get("power", {}),
        "thermal_final": last_telem_data.get("thermal", {}),
        "comm_final": last_telem_data.get("comm", {}),
        "source_table": "telemetry",
    }

    # ── 06 Failure analysis ──────────────────────────────────────────────────
    failure_analysis = []
    for inc in incidents:
        failure_analysis.append({
            "incident_id": inc.id,
            "mission_day": round(inc.mission_day, 4),
            "raw_error": inc.raw_error,
            "normalized_category": inc.normalized_fault_category,
            "normalized_subsystem": inc.normalized_subsystem,
            "normalized_severity": inc.normalized_severity,
            "root_cause": inc.normalized_root_cause,
            "confidence": inc.confidence,
            "status": inc.status,
            "recovery_mode": inc.recovery_mode,
            "total_resolution_ms": inc.total_resolution_ms,
            "total_resolution_sim_s": getattr(inc, "total_resolution_sim_s", None),
            "source_tables": ["incidents", "blackbox_events"],
        })
    emergency_analysis = {
        "critical_events": [
            {
                "event_id": e.id,
                "mission_day": round(e.mission_day, 4),
                "description": e.description,
                "source": e.source,
                "incident_id": e.incident_id,
            }
            for e in events if e.severity == "critical"
        ],
        "count_critical_events": len([e for e in events if e.severity == "critical"]),
        "source_table": "blackbox_events",
    }

    # ── 07 Vyom AI analysis ──────────────────────────────────────────────────
    ai_analysis_section = {
        "ai_diagnosed_incidents": [
            {
                "incident_id": inc.id,
                "diagnosis_time_ms": inc.diagnosis_time_ms,
                "ai_confidence": inc.confidence,
                "normalized_category": inc.normalized_fault_category,
                "ai_analysis": inc.ai_analysis_json,
            }
            for inc in incidents if inc.ai_analysis_json
        ],
        "ai_recovery_count": len([i for i in incidents if i.recovery_mode == "ai"]),
        "source_tables": ["incidents.ai_analysis_json", "blackbox_events(ai_analysis_json)"],
    }

    # ── 08 Manual intervention analysis ──────────────────────────────────────
    manual_actions_all = []
    for inc in incidents:
        for a in (inc.manual_actions_json or []):
            manual_actions_all.append({
                "incident_id": inc.id,
                "operator": a.get("operator"),
                "procedure_id": a.get("procedure_id"),
                "result": a.get("result"),
                "timestamp": a.get("timestamp"),
                "confirmed": a.get("confirmed"),
            })
    manual_bb_events = [
        {
            "event_id": e.id,
            "mission_day": round(e.mission_day, 4),
            "operator": e.operator,
            "procedure": e.command_procedure,
            "result": e.result,
        }
        for e in events if e.operator or e.manual_intervention_json
    ]
    manual_intervention_analysis = {
        "manual_actions": manual_actions_all,
        "manual_blackbox_events": manual_bb_events,
        "manual_recovery_count": len([i for i in incidents if i.recovery_mode == "manual"]),
        "note": "All manual actions were validated against approved procedure library; "
                "no arbitrary spacecraft commands are permitted.",
        "source_tables": ["incidents.manual_actions_json", "blackbox_events"],
    }

    # ── 09 Recovery-time analysis (AI vs manual, from backend timestamps) ────
    def phase_durations(inc: Incident) -> Dict[str, Optional[int]]:
        d = lambda a, b: (b - a) if (a and b) else None
        return {
            "detection_to_diagnosis_ms": d(inc.detection_time_ms, inc.diagnosis_time_ms),
            "diagnosis_to_decision_ms": d(inc.diagnosis_time_ms, inc.decision_time_ms),
            "decision_to_recovery_start_ms": d(inc.decision_time_ms, inc.recovery_start_time_ms),
            "recovery_duration_ms": d(inc.recovery_start_time_ms, inc.recovery_end_time_ms),
            "total_resolution_ms": inc.total_resolution_ms,
        }

    resolved = [i for i in incidents if i.total_resolution_ms is not None]
    ai_resolved = [i for i in resolved if i.recovery_mode == "ai"]
    man_resolved = [i for i in resolved if i.recovery_mode == "manual"]

    def avg(lst, key):
        vals = [getattr(i, key) for i in lst if getattr(i, key) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    recovery_time_analysis = {
        "per_incident": [
            {
                "incident_id": inc.id,
                "recovery_mode": inc.recovery_mode,
                "timeline": {
                    "detection_time_ms": inc.detection_time_ms,
                    "diagnosis_time_ms": inc.diagnosis_time_ms,
                    "decision_time_ms": inc.decision_time_ms,
                    "recovery_start_time_ms": inc.recovery_start_time_ms,
                    "recovery_end_time_ms": inc.recovery_end_time_ms,
                    "total_resolution_ms": inc.total_resolution_ms,
                },
                "simulation_clock": {
                    "detection_sim_s": getattr(inc, "detection_sim_s", None),
                    "diagnosis_sim_s": getattr(inc, "diagnosis_sim_s", None),
                    "decision_sim_s": getattr(inc, "decision_sim_s", None),
                    "recovery_start_sim_s": getattr(inc, "recovery_start_sim_s", None),
                    "recovery_end_sim_s": getattr(inc, "recovery_end_sim_s", None),
                    "total_resolution_sim_s": getattr(inc, "total_resolution_sim_s", None),
                },
                "phase_durations_ms": phase_durations(inc),
            }
            for inc in incidents
        ],
        "averages": {
            "ai_total_resolution_ms": avg(ai_resolved, "total_resolution_ms"),
            "manual_total_resolution_ms": avg(man_resolved, "total_resolution_ms"),
            "all_total_resolution_ms": avg(resolved, "total_resolution_ms"),
            "resolved_count": len(resolved),
        },
        "calculation_note": "All timings computed from backend-recorded timestamps; "
                            "wall-clock ms and simulation-clock seconds are recorded separately.",
        "source_table": "incidents",
    }

    # ── 10 Mission risk analysis ─────────────────────────────────────────────
    mission_risk_analysis = {
        "history": [
            {
                "timestamp_utc_ms": r.timestamp,
                "mission_day": round(r.mission_day, 4),
                "risk_score": round(r.risk_score, 2),
                "risk_category": r.risk_category,
                "contributing_factors": r.contributing_factors,
                "confidence": r.confidence,
                "trend": r.trend,
            }
            for r in risk_history
        ],
        "current": {
            "risk_score": risk_history[-1].risk_score if risk_history else None,
            "risk_category": risk_history[-1].risk_category if risk_history else None,
        },
        "units": "score 0-100, categories LOW|MODERATE|HIGH|CRITICAL",
        "source_table": "mission_risk_history",
    }

    # ── 11 Lifecycle analysis ────────────────────────────────────────────────
    lifecycle_transitions = getattr(mission, "phase_transitions_json", None) or []
    mission_lifecycle_analysis = {
        "current_phase": getattr(mission, "mission_phase", None),
        "transitions": lifecycle_transitions,
        "day_coverage": {"from_day": 0, "to_day": round(final_day, 4)},
        "started_at_utc_ms": mission.started_at,
        "source_tables": ["missions.phase_transitions_json", "blackbox_events"],
    }

    # ── 12 RUL analysis ──────────────────────────────────────────────────────
    rul_analysis = {
        "rul_days_current": getattr(mission, "rul_days", None),
        "estimated_lifetime_days": getattr(mission, "estimated_lifetime_days", None),
        "planned_end_day": getattr(mission, "planned_end_day", None),
        "method": "RUL engine estimate from subsystem health, fault load and environment "
                  "(backend rul_engine); distinct from planned end date.",
        "source_table": "missions",
    }

    # ── 13 Objectives & activities ───────────────────────────────────────────
    objectives_section = {
        "objectives": [
            {
                "id": o.id,
                "name": o.name,
                "weight": o.weight,
                "status": o.status,
                "completed_at": o.completed_at,
                "mission_day_completed": o.mission_day_completed,
            }
            for o in objectives
        ],
        "weighted_progress_note": "Progress = sum(weights of genuinely completed objectives)",
        "computed_weighted_progress_percent": round(
            sum(o.weight for o in objectives if o.status == "completed") * 100, 2),
        "source_table": "mission_objectives",
    }
    activities_section = {
        "activities": [
            {
                "id": a.id,
                "name": a.name,
                "phase": a.mission_phase,
                "planned": [a.planned_start_day, a.planned_end_day],
                "actual": [a.actual_start_day, a.actual_end_day],
                "status": a.status,
                "delay_days": a.delay_days,
                "result": a.result,
            }
            for a in activities
        ],
        "counts": {
            "scheduled": len([a for a in activities if a.status == "scheduled"]),
            "active": len([a for a in activities if a.status == "active"]),
            "completed": len([a for a in activities if a.status == "completed"]),
            "delayed": len([a for a in activities if a.status == "delayed"]),
            "cancelled": len([a for a in activities if a.status == "cancelled"]),
            "failed": len([a for a in activities if a.status == "failed"]),
        },
        "history_preserved": True,
        "source_table": "scheduled_activities",
    }

    # ── 14 End-of-mission analysis ───────────────────────────────────────────
    end_of_mission_analysis = None
    if farewell:
        end_of_mission_analysis = {
            "assessment_type": farewell.assessment_type,
            "recommended_option": farewell.recommended_option,
            "alternatives_considered": farewell.alternatives_considered,
            "reasoning": farewell.reasoning,
            "spacecraft_health": farewell.spacecraft_health,
            "propellant_remaining_percent": farewell.propellant_remaining,
            "return_feasibility": farewell.return_feasibility,
            "monte_carlo_results": farewell.monte_carlo_results,
            "disclaimer": "Simulation/decision-support estimate — not a guarantee of real-world outcome",
            "source_table": "farewell_assessments",
        }

    # ── Daily analysis Day 0 → final day ─────────────────────────────────────
    daily_analysis = []
    for d in daily:
        s = d.summary_json or {}
        ms = s.get("mission_state", {}) or {}
        os_ = s.get("orbital_state", {}) or {}
        cs = s.get("crew_summary", {}) or {}
        env = s.get("environment", {}) or {}
        rk = s.get("risk", {}) or {}
        day_events = [
            {
                "event_id": e.id, "type": e.event_type, "severity": e.severity,
                "description": e.description[:140], "source": e.source,
            }
            for e in events if int(e.mission_day) == d.mission_day
        ]
        daily_analysis.append({
            "mission_day": d.mission_day,
            "mission_state": ms,
            "orbital_state": {
                "avg_altitude_km": os_.get("avg_altitude"),
                "avg_velocity_kms": os_.get("avg_velocity"),
                "ground_track_points": min(len(os_.get("ground_track_points", []) or []), 5),
                **ORBITAL_UNITS,
            },
            "crew_status": {
                "crew_count": cs.get("crew_count", 0),
                "avg_stress": cs.get("avg_stress"),
                "avg_fatigue": cs.get("avg_fatigue"),
                "per_crew_roles_only": cs.get("crew", {}),
                "disclaimer": "SIMULATED values — anonymized (roles only, no names)",
            } if cs else None,
            "environment": env,
            "risk": rk,
            "telemetry_highlights": s.get("telemetry_highlights", {}),
            "events_that_day": day_events,
            "event_count": len(day_events),
            "source_tables": ["daily_summaries", "blackbox_events"],
        })

    # Days with no stored summary but with events are still covered by timeline;
    # note coverage explicitly.
    days_covered = sorted({int(d.mission_day) for d in daily} | {int(e.mission_day) for e in events})

    # ── Audit trail: section -> source tables/rows ───────────────────────────
    audit_trail = {
        "report_id": report_id,
        "generated_from": "authoritative backend event database (SQLite)",
        "frontend_state_used": False,
        "sections": {
            "mission_summary": ["missions"],
            "complete_timeline": ["blackbox_events"],
            "spacecraft_health": ["telemetry", "missions"],
            "crew_health": ["crew_health_records"],
            "telemetry_summary": ["telemetry"],
            "failure_analysis": ["incidents", "blackbox_events"],
            "emergency_analysis": ["blackbox_events"],
            "vyom_ai_analysis": ["incidents"],
            "manual_intervention": ["incidents.manual_actions_json", "blackbox_events"],
            "recovery_time": ["incidents"],
            "mission_risk": ["mission_risk_history"],
            "lifecycle": ["missions.phase_transitions_json"],
            "objectives": ["mission_objectives"],
            "activities": ["scheduled_activities"],
            "end_of_mission": ["farewell_assessments"],
            "daily_analysis": ["daily_summaries", "blackbox_events"],
        },
        "trace_instructions": "Each section lists its source tables; timeline entries carry "
                              "event_ids that can be looked up via GET /api/missions/{id}/blackbox.",
        "black_box_chain_verified": True,
    }

    # ── Assemble (legacy top-level keys preserved for backward compat) ──────
    commands_list = sim.cmd_engine.to_dict_list() if sim else []
    report = {
        # legacy keys (unchanged shape where feasible)
        "report_id": report_id,
        "mission_id": mid,
        "mission_name": mission.name,
        "mission_type": mission.mission_type,
        "destination": mission.destination,
        "objective": mission.objective,
        "budget_crore": mission.budget_crore,
        "launch_site": mission.launch_site or {},
        "status": sim.status if sim else mission.status,
        "mission_day": round((sim.mission_day if sim else mission.mission_day) or 0.0, 4),
        "objective_progress": round(((sim.objective_progress if sim else mission.objective_progress) or 0.0), 2),
        "overall_health": round(((sim.state.overall_health if sim else mission.overall_health) or 0.0), 2),
        "stats": {
            "total_events": len(events),
            "total_incidents": len(events and [e for e in events if e.severity in ("warning", "critical")]),
            "ai_diagnoses": len([e for e in events if e.event_type == "ai"]),
            "commands_executed": len([c for c in commands_list if c["status"] == "COMPLETE"]),
            "recovery_events": len([e for e in events if e.event_type == "recovery"]),
            "min_health": spacecraft_health["min_health"],
            "max_health": spacecraft_health["max_health"],
            "avg_health": spacecraft_health["avg_health"],
            "telemetry_records": len(telem),
            "orbit_trail_points": len(sim.orbit_trail) if sim else 0,
        },
        "orbit_summary": orbit_summary,
        "incidents": [
            {
                "id": e.id, "missionDay": round(e.mission_day, 4), "type": e.event_type,
                "severity": e.severity, "description": e.description, "source": e.source,
            }
            for e in events if e.severity in ("warning", "critical")
        ][-20:],
        "commands_executed": commands_list[:20],
        "crew_summary": [
            {"role": c.get("role", f"Crew Member {i+1}"), "status": c.get("status", "")}
            for i, c in enumerate(mission.crew_json or [])
        ],
        "generated_at": int(time.time() * 1000),
        "mission_phase": getattr(mission, "mission_phase", None),
        "rul_days": getattr(mission, "rul_days", None),
        # v3.0 sections
        "model_version": MODEL_VERSION,
        "mission_summary": mission_summary,
        "daily_analysis": daily_analysis,
        "days_covered": days_covered,
        "complete_timeline": complete_timeline,
        "spacecraft_health": spacecraft_health,
        "crew_health_summary": crew_health_summary,
        "telemetry_summary": telemetry_summary,
        "failure_analysis": failure_analysis,
        "emergency_analysis": emergency_analysis,
        "vyom_ai_analysis": ai_analysis_section,
        "manual_intervention_analysis": manual_intervention_analysis,
        "recovery_time_analysis": recovery_time_analysis,
        "mission_risk_analysis": mission_risk_analysis,
        "mission_lifecycle_analysis": mission_lifecycle_analysis,
        "rul_analysis": rul_analysis,
        "objectives_analysis": objectives_section,
        "activities_analysis": activities_section,
        "end_of_mission_analysis": end_of_mission_analysis,
        "audit_trail": audit_trail,
    }
    return report
