"""
VYOM Backend — Supabase Real-Time Synchronizer Service (Phase 1)
Allows authoritative physics loop to optionally mirror telemetry and state to Supabase.
"""
import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("vyom.supabase")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")

_client: Optional[Any] = None

def is_supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY and not SUPABASE_URL.startswith("https://your-vyom-project"))

def get_supabase_client():
    global _client
    if not is_supabase_enabled():
        return None
    if _client is None:
        try:
            import httpx
            _client = httpx.Client(
                base_url=f"{SUPABASE_URL}/rest/v1",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                timeout=5.0
            )
            logger.info("✓ [VYOM Supabase] Backend REST sync initialized for %s", SUPABASE_URL)
        except Exception as e:
            logger.warning("⚠️ [VYOM Supabase] Could not initialize REST sync: %s", e)
            _client = None
    return _client

def sync_telemetry_reading(spacecraft_id: str, channel_name: str, value: float, source: str = "simulation"):
    """Optionally sync a telemetry reading to Supabase if configured."""
    client = get_supabase_client()
    if not client:
        return
    try:
        payload = {
            "spacecraft_id": spacecraft_id,
            "value": value,
            "quality": "good",
            "source": source
        }
        client.post("/telemetry_readings", json=payload)
    except Exception as e:
        logger.debug("Supabase sync telemetry failed: %s", e)
