from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps vehicle_id (str or int) to a list of connected WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, vehicle_id: str):
        await websocket.accept()
        if vehicle_id not in self.active_connections:
            self.active_connections[vehicle_id] = []
        self.active_connections[vehicle_id].append(websocket)

    def disconnect(self, websocket: WebSocket, vehicle_id: str):
        if vehicle_id in self.active_connections:
            if websocket in self.active_connections[vehicle_id]:
                self.active_connections[vehicle_id].remove(websocket)
            if not self.active_connections[vehicle_id]:
                del self.active_connections[vehicle_id]

    async def broadcast(self, message: dict, vehicle_id: str):
        if vehicle_id in self.active_connections:
            for connection in self.active_connections[vehicle_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
