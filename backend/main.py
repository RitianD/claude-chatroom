from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Query, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import shutil
import aiofiles

from database import get_db, init_db, User, Message, MusicQueue
from auth import (
    get_password_hash, verify_password, create_access_token,
    decode_token, get_current_user, SECRET_KEY, ALGORITHM
)
from websocket_manager import manager
from jose import jwt

# Initialize FastAPI
app = FastAPI(title="Chatroom API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploaded music
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Initialize database
init_db()


# Pydantic models for request/response
from pydantic import BaseModel


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class ChatMessage(BaseModel):
    content: str
    message_type: str = "text"  # 'text' or 'music'
    music_url: Optional[str] = None


class MusicRequest(BaseModel):
    music_url: str
    title: Optional[str] = None


# ============ REST API Endpoints ============

@app.post("/api/register")
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Create new user
    new_user = User(
        username=user_data.username,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/api/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login and return JWT token"""
    user = db.query(User).filter(User.username == user_data.username).first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }


@app.get("/api/messages")
async def get_messages(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get recent chat messages"""
    messages = db.query(Message).order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()  # Return in chronological order

    result = []
    for msg in messages:
        result.append({
            "id": msg.id,
            "user_id": msg.user_id,
            "username": msg.user.username,
            "content": msg.content,
            "message_type": msg.message_type,
            "music_url": msg.music_url,
            "created_at": msg.created_at.isoformat()
        })

    return result


@app.get("/api/queue")
async def get_queue(db: Session = Depends(get_db)):
    """Get current music queue"""
    queue_items = db.query(MusicQueue).order_by(MusicQueue.added_at.asc()).all()

    result = []
    for item in queue_items:
        result.append({
            "id": item.id,
            "user_id": item.user_id,
            "username": item.user.username,
            "music_url": item.music_url,
            "title": item.title,
            "added_at": item.added_at.isoformat()
        })

    return {"queue": result}


@app.post("/api/upload-music")
async def upload_music(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a music file"""
    # Validate file type
    allowed_extensions = [".mp3", ".wav", ".m4a", ".ogg", ".flac"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Validate file size (50MB limit)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 50MB limit"
        )

    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join("uploads", filename)

    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Return file URL
    file_url = f"/uploads/{filename}"

    return {
        "message": "File uploaded successfully",
        "music_url": file_url,
        "filename": filename
    }


# ============ WebSocket Endpoints ============

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """WebSocket connection for real-time chat"""

    # Verify token and get user
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Connect user
    await manager.connect(websocket, user_id, user.username)

    # Notify others that user joined
    await manager.broadcast({
        "type": "user_joined",
        "user_id": user_id,
        "username": user.username,
        "online_users": manager.get_online_users()
    }, exclude_user_id=user_id)

    # Send current queue to new user
    queue_items = db.query(MusicQueue).order_by(MusicQueue.added_at.asc()).all()
    queue_data = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "username": item.user.username,
            "music_url": item.music_url,
            "title": item.title,
            "added_at": item.added_at.isoformat()
        }
        for item in queue_items
    ]
    await manager.send_personal_message({
        "type": "queue_update",
        "queue": queue_data
    }, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat_message":
                # Handle text message
                content = data.get("content", "")
                if content:
                    # Save to database
                    new_message = Message(
                        user_id=user_id,
                        content=content,
                        message_type="text"
                    )
                    db.add(new_message)
                    db.commit()

                    # Broadcast to all users
                    await manager.broadcast({
                        "type": "new_message",
                        "id": new_message.id,
                        "user_id": user_id,
                        "username": user.username,
                        "content": content,
                        "message_type": "text",
                        "created_at": new_message.created_at.isoformat()
                    })

            elif message_type == "music_message":
                # Handle music URL message
                music_url = data.get("music_url", "")
                title = data.get("title", "Unknown")

                if music_url:
                    # Save to database
                    new_message = Message(
                        user_id=user_id,
                        content=f"Shared music: {title}",
                        message_type="music",
                        music_url=music_url
                    )
                    db.add(new_message)
                    db.commit()

                    # Broadcast to all users
                    await manager.broadcast({
                        "type": "new_message",
                        "id": new_message.id,
                        "user_id": user_id,
                        "username": user.username,
                        "content": f"Shared music: {title}",
                        "message_type": "music",
                        "music_url": music_url,
                        "created_at": new_message.created_at.isoformat()
                    })

            elif message_type == "add_to_queue":
                # Handle add to queue request
                music_url = data.get("music_url", "")
                title = data.get("title", "Unknown")

                if music_url:
                    # Add to queue
                    new_queue_item = MusicQueue(
                        user_id=user_id,
                        music_url=music_url,
                        title=title
                    )
                    db.add(new_queue_item)
                    db.commit()

                    # Get updated queue
                    queue_items = db.query(MusicQueue).order_by(MusicQueue.added_at.asc()).all()
                    queue_data = [
                        {
                            "id": item.id,
                            "user_id": item.user_id,
                            "username": item.user.username,
                            "music_url": item.music_url,
                            "title": item.title,
                            "added_at": item.added_at.isoformat()
                        }
                        for item in queue_items
                    ]

                    # Broadcast queue update
                    await manager.broadcast({
                        "type": "queue_update",
                        "queue": queue_data
                    })

            elif message_type == "remove_from_queue":
                # Handle remove from queue request
                queue_id = data.get("queue_id")
                if queue_id:
                    db.query(MusicQueue).filter(MusicQueue.id == queue_id).delete()
                    db.commit()

                    # Get updated queue
                    queue_items = db.query(MusicQueue).order_by(MusicQueue.added_at.asc()).all()
                    queue_data = [
                        {
                            "id": item.id,
                            "user_id": item.user_id,
                            "username": item.user.username,
                            "music_url": item.music_url,
                            "title": item.title,
                            "added_at": item.added_at.isoformat()
                        }
                        for item in queue_items
                    ]

                    # Broadcast queue update
                    await manager.broadcast({
                        "type": "queue_update",
                        "queue": queue_data
                    })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        # Notify others that user left
        await manager.broadcast({
            "type": "user_left",
            "user_id": user_id,
            "username": user.username,
            "online_users": manager.get_online_users()
        })
    except Exception as e:
        manager.disconnect(user_id)
        await manager.broadcast({
            "type": "user_left",
            "user_id": user_id,
            "username": user.username,
            "online_users": manager.get_online_users()
        })


@app.get("/")
async def root():
    return {"message": "Chatroom API Server", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
