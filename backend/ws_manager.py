"""
WebSocket connection manager — upgraded from the original to:
  - Authenticate connections via ?token= query parameter before accepting.
  - Track {websocket, user_id, role, device_ids} per connection.
  - Deliver messages only to authorised connections (scoped broadcast).
  - Support two message types: ALERT and TELEMETRY_UPDATE.
"""
import json
import logging
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionInfo:
    __slots__ = ("websocket", "user_id", "role", "device_ids")

    def __init__(self, websocket: WebSocket, user_id: int, role: str, device_ids: list[int]):
        self.websocket  = websocket
        self.user_id    = user_id
        self.role       = role
        self.device_ids = device_ids   # empty list means admin (sees all)


class ConnectionManager:
    def __init__(self):
        self._connections: list[ConnectionInfo] = []

    def _add(self, info: ConnectionInfo) -> None:
        self._connections.append(info)

    def remove(self, websocket: WebSocket) -> None:
        self._connections = [c for c in self._connections if c.websocket is not websocket]

    async def accept_authenticated(
        self,
        websocket: WebSocket,
        user_id: int,
        role: str,
        device_ids: list[int],
    ) -> None:
        """Accept a WebSocket connection and register the authenticated user."""
        await websocket.accept()
        self._add(ConnectionInfo(websocket, user_id, role, device_ids))
        log.debug("WS connected: user_id=%s role=%s device_ids=%s", user_id, role, device_ids)

    async def broadcast_to_scoped(self, message: dict[str, Any], device_id: int) -> None:
        """
        Deliver `message` to:
          - Every connected admin (role == "admin")
          - Any connected user whose device_ids list includes device_id
        """
        dead: list[WebSocket] = []
        for conn in self._connections:
            is_admin      = conn.role == "admin"
            is_assigned   = device_id in conn.device_ids
            if not (is_admin or is_assigned):
                continue
            try:
                await conn.websocket.send_json(message)
            except Exception:
                dead.append(conn.websocket)

        for ws in dead:
            self.remove(ws)

    async def broadcast_all(self, message: dict[str, Any]) -> None:
        """Deliver to every connected client regardless of role (used for system messages)."""
        dead: list[WebSocket] = []
        for conn in self._connections:
            try:
                await conn.websocket.send_json(message)
            except Exception:
                dead.append(conn.websocket)
        for ws in dead:
            self.remove(ws)


# Singleton — imported by main.py and any router/simulator that needs to broadcast
manager = ConnectionManager()
