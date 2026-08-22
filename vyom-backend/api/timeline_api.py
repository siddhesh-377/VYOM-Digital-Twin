import time
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, BlackBoxEvent, ScheduledActivity, DailySummary, MissionObjective
from core.schemas import DailySummarySchema

router = APIRouter(prefix="/api/missions/{mission_id}/timeline", tags=["timeline"])


@router.get("")
def get_timeline(mission_id: str, db: Session = Depends(get_db)):
    """Get complete mission timeline combining blackbox events, activities, and milestones."""
    bb_events = db.query(BlackBoxEvent).filter(BlackBoxEvent.mission_id == mission_id).order_by(BlackBoxEvent.mission_day, BlackBoxEvent.timestamp).all()
    activities = db.query(ScheduledActivity).filter(ScheduledActivity.mission_id == mission_id).all()
    milestones = db.query(MissionObjective).filter(MissionObjective.mission_id == mission_id).all()
    
    timeline = []
    
    for ev in bb_events:
        timeline.append({
            "id": ev.id,
            "mission_day": ev.mission_day,
            "timestamp": ev.timestamp,
            "event_type": "blackbox",
            "severity": ev.severity,
            "description": ev.description,
            "source": ev.source,
            "details": {"event_type": ev.event_type, "incident_id": ev.incident_id},
        })
    
    for act in activities:
        timeline.append({
            "mission_day": act.planned_start_day,
            "timestamp": int(act.created_at) if act.created_at else int(time.time()*1000),
            "event_type": "activity",
            "severity": "info",
            "description": f"Activity: {act.name}",
            "source": "Schedule",
            "details": {"status": act.status}
        })
        
    for ms in milestones:
        if ms.mission_day_completed is not None:
            timeline.append({
                "mission_day": ms.mission_day_completed,
                "timestamp": int(ms.completed_at) if ms.completed_at else int(time.time()*1000),
                "event_type": "milestone",
                "severity": "success",
                "description": f"Milestone Completed: {ms.name}",
                "source": "Objectives",
                "details": {"status": ms.status}
            })
            
    timeline.sort(key=lambda x: (x["mission_day"], x["timestamp"]))
    return timeline


@router.get("/day/{day}")
def get_day_events(mission_id: str, day: int, db: Session = Depends(get_db)):
    """Get all events for a specific mission day."""
    bb_events = db.query(BlackBoxEvent).filter(
        BlackBoxEvent.mission_id == mission_id,
        BlackBoxEvent.mission_day >= day,
        BlackBoxEvent.mission_day < day + 1
    ).all()
    
    activities = db.query(ScheduledActivity).filter(
        ScheduledActivity.mission_id == mission_id,
        ScheduledActivity.planned_start_day <= day,
        ScheduledActivity.planned_end_day >= day
    ).all()
    
    events = []
    for ev in bb_events:
        events.append({
            "id": ev.id,
            "type": "blackbox",
            "mission_day": ev.mission_day,
            "timestamp": ev.timestamp,
            "description": ev.description,
            "severity": ev.severity
        })
        
    for act in activities:
        events.append({
            "id": act.id,
            "type": "activity",
            "mission_day": act.planned_start_day,
            "timestamp": act.created_at,
            "description": act.name,
            "severity": "info",
            "status": act.status
        })
        
    return events


@router.get("/daily-summaries")
def get_all_summaries(mission_id: str, db: Session = Depends(get_db)):
    """Get all daily summaries for a mission."""
    summaries = db.query(DailySummary).filter(DailySummary.mission_id == mission_id).order_by(DailySummary.mission_day).all()
    return [
        {
            "mission_day": s.mission_day,
            "summary_json": s.summary_json,
            "orbital_path_json": s.orbital_path_json
        }
        for s in summaries
    ]


@router.get("/daily-summaries/{day}")
def get_day_summary(mission_id: str, day: int, db: Session = Depends(get_db)):
    """Get single daily summary for replay."""
    summary = db.query(DailySummary).filter(DailySummary.mission_id == mission_id, DailySummary.mission_day == day).first()
    if not summary:
        raise HTTPException(404, "Daily summary not found")
        
    return {
        "mission_day": summary.mission_day,
        "summary_json": summary.summary_json,
        "orbital_path_json": summary.orbital_path_json
    }
