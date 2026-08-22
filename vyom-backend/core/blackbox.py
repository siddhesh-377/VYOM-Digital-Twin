"""
VYOM Backend — Black Box append-only writer.
All Black Box writes go through here. Records are never updated or deleted;
corrections are new events referencing the original via `correction_of`.
Each event carries a SHA-256 chain hash over its content plus the previous
event's hash, making silent tampering detectable.
"""
import hashlib
import json
from typing import Optional

from sqlalchemy.orm import Session

from core.database import BlackBoxEvent as BBEvent


def _compute_hash(event: BBEvent) -> str:
    payload = json.dumps({
        "id": event.id,
        "mission_id": event.mission_id,
        "mission_day": event.mission_day,
        "timestamp": event.timestamp,
        "event_type": event.event_type,
        "severity": event.severity,
        "description": event.description,
        "source": event.source,
        "incident_id": event.incident_id,
        "correction_of": event.correction_of,
        "prev_hash": event.prev_hash,
    }, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def append_event(db: Session, **fields) -> BBEvent:
    """Append an immutable, hash-chained event to the Black Box."""
    mission_id = fields["mission_id"]
    last = (
        db.query(BBEvent)
        .filter(BBEvent.mission_id == mission_id)
        .order_by(BBEvent.timestamp.desc(), BBEvent.id.desc())
        .first()
    )
    ev = BBEvent(**fields, prev_hash=last.event_hash if last else None)
    ev.event_hash = _compute_hash(ev)
    db.add(ev)
    return ev


def verify_chain(db: Session, mission_id: str) -> dict:
    """Verify the integrity of a mission's Black Box hash chain."""
    events = (
        db.query(BBEvent)
        .filter(BBEvent.mission_id == mission_id)
        .order_by(BBEvent.timestamp.asc(), BBEvent.id.asc())
        .all()
    )
    total = len(events)
    broken_at = None
    prev_hash: Optional[str] = None
    for i, ev in enumerate(events):
        if ev.prev_hash != prev_hash:
            broken_at = ev.id
            break
        if ev.event_hash and ev.event_hash != _compute_hash(ev):
            broken_at = ev.id
            break
        prev_hash = ev.event_hash
    return {"mission_id": mission_id, "total_events": total,
            "chain_intact": broken_at is None, "broken_at_event": broken_at}
