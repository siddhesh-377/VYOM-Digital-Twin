"""
VYOM Backend — WebSocket Connection Hub
Manages all connected WebSocket clients per mission and broadcasts messages.
"""
import asyncio
import json
import logging
from typing import Dict, Set, List, Any
from fastapi import WebSocket

logger = logging.getLogger("vyom.ws")


class ConnectionManager:
    """Manages WebSocket connections grouped by mission_id."""

    def __init__(self):
        # mission_id -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, mission_id: str, websocket: WebSocket):
        await websocket.accept()
        if mission_id not in self._connections:
            self._connections[mission_id] = set()
        self._connections[mission_id].add(websocket)
        logger.info(f"[WS] Client connected to mission {mission_id}. Total: {len(self._connections[mission_id])}")

    def disconnect(self, mission_id: str, websocket: WebSocket):
        if mission_id in self._connections:
            self._connections[mission_id].discard(websocket)
            if not self._connections[mission_id]:
                del self._connections[mission_id]
        logger.info(f"[WS] Client disconnected from mission {mission_id}")

    async def broadcast(self, mission_id: str, messages: List[Dict[str, Any]]):
        """Send a list of messages to all clients connected to mission_id.

        Each client is sent in its own task so one slow/stuck client cannot
        stall the mission simulation loop.
        """
        clients = self._connections.get(mission_id, set()).copy()
        if not clients:
            return

        async def _send(ws: WebSocket):
            for msg in messages:
                await ws.send_text(json.dumps(msg))

        results = await asyncio.gather(*(_send(ws) for ws in clients), return_exceptions=True)

        dead_clients = {ws for ws, res in zip(clients, results) if isinstance(res, Exception)}
        for ws in dead_clients:
            self._connections.get(mission_id, set()).discard(ws)

    def get_broadcast_fn(self, mission_id: str):
        """Return a coroutine function that broadcasts to a specific mission."""
        async def _broadcast(messages: List[Dict]):
            await self.broadcast(mission_id, messages)
        return _broadcast

    def client_count(self, mission_id: str) -> int:
        return len(self._connections.get(mission_id, set()))


# Global connection manager
manager = ConnectionManager()


async def websocket_endpoint(mission_id: str, websocket: WebSocket):
    """Handle a new WebSocket connection for a mission."""
    from simulation.loop import get_simulation

    await manager.connect(mission_id, websocket)

    # Register broadcast callback with simulation
    sim = get_simulation(mission_id)
    if sim:
        sim.broadcast_callback = manager.get_broadcast_fn(mission_id)

        # Send initial state immediately
        from engines.telemetry_engine import build_telemetry_dict
        telem = build_telemetry_dict(sim.state, sim.mission_day)
        await websocket.send_text(json.dumps({"type": "CONNECTED", "payload": {
            "missionId": mission_id,
            "status": sim.status,
            "missionDay": sim.mission_day,
            "timeMultiplier": sim.time_multiplier,
            "objectiveProgress": sim.objective_progress,
        }}))
        await websocket.send_text(json.dumps({"type": "TELEMETRY_UPDATE", "payload": telem}))

    try:
        while True:
            # Listen for client commands (e.g., time multiplier changes)
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                await _handle_client_message(mission_id, msg)
            except json.JSONDecodeError:
                pass
    except Exception as e:
        logger.info("[WS] Connection %s ended: %s", websocket, e)
    finally:
        manager.disconnect(mission_id, websocket)
        # Reassign broadcast if other clients remain
        sim = get_simulation(mission_id)
        if sim and manager.client_count(mission_id) > 0:
            sim.broadcast_callback = manager.get_broadcast_fn(mission_id)
        elif sim:
            sim.broadcast_callback = None


async def _handle_client_message(mission_id: str, msg: Dict):
    """Handle messages sent from client to server over WS."""
    from simulation.loop import set_time_multiplier, pause_simulation, resume_simulation, get_simulation

    msg_type = msg.get("type", "")

    if msg_type == "SET_TIME_MULTIPLIER":
        m = msg.get("payload", {}).get("multiplier", 1)
        set_time_multiplier(mission_id, int(m))

    elif msg_type == "PAUSE":
        pause_simulation(mission_id)

    elif msg_type == "RESUME":
        resume_simulation(mission_id)
