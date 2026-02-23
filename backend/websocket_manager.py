from typing import List, Dict
from fastapi import WebSocket, WebSocketDisconnect
import json


class ConnectionManager:
    def __init__(self):
        # Store active connections with user info
        self.active_connections: Dict[int, WebSocket] = {}
        self.usernames: Dict[int, str] = {}

    async def connect(self, websocket: WebSocket, user_id: int, username: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.usernames[user_id] = username

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.usernames:
            del self.usernames[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_json(message)

    async def broadcast(self, message: dict, exclude_user_id: int = None):
        disconnected = []
        for user_id, websocket in self.active_connections.items():
            if exclude_user_id and user_id == exclude_user_id:
                continue
            try:
                await websocket.send_json(message)
            except:
                disconnected.append(user_id)

        # Clean up disconnected connections
        for user_id in disconnected:
            self.disconnect(user_id)

    def get_online_users(self) -> List[dict]:
        return [
            {"user_id": user_id, "username": self.usernames.get(user_id, "Unknown")}
            for user_id in self.active_connections.keys()
        ]

    def get_online_usernames(self) -> List[str]:
        return list(self.usernames.values())


manager = ConnectionManager()
