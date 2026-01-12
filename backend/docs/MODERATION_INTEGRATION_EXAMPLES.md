# AI Moderation Integration Examples

## Real-World Integration Patterns

This document provides production-ready examples for integrating the AI moderation system into various applications.

## Table of Contents

1. [FastAPI REST API Integration](#fastapi-rest-api-integration)
2. [WebSocket Real-time Chat](#websocket-real-time-chat)
3. [Discord Bot Integration](#discord-bot-integration)
4. [Message Queue Processing](#message-queue-processing)
5. [Database Integration](#database-integration)
6. [Admin Dashboard](#admin-dashboard)
7. [Custom Workflows](#custom-workflows)

---

## FastAPI REST API Integration

### Basic REST Endpoint

```python
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

app = FastAPI()

class MessageRequest(BaseModel):
    content: str
    user_id: str
    chat_id: str

class ModerationResponse(BaseModel):
    approved: bool
    message_id: str
    action: str | None
    reason: str | None
    flagged: bool

@app.post("/api/moderate", response_model=ModerationResponse)
async def moderate_endpoint(request: MessageRequest):
    """Moderate a message before allowing it"""

    # Create message object
    message = ChatMessage(
        message_id=generate_message_id(),
        content=request.content,
        user_id=request.user_id
    )

    # Run moderation
    state = await moderate_message(message)

    # Determine approval
    approved = state.recommended_action is None

    return ModerationResponse(
        approved=approved,
        message_id=message.message_id,
        action=state.recommended_action.action.value if state.recommended_action else None,
        reason=state.recommended_action.reason if state.recommended_action else None,
        flagged=state.flag
    )
```

### With User Strike System

```python
from datetime import datetime, timedelta
from typing import Dict

# In-memory strike tracking (use Redis/database in production)
user_strikes: Dict[str, list] = {}

class StrikeSystem:
    MAX_STRIKES = 3
    STRIKE_EXPIRY = timedelta(days=7)

    @staticmethod
    def add_strike(user_id: str, reason: str):
        if user_id not in user_strikes:
            user_strikes[user_id] = []

        user_strikes[user_id].append({
            "timestamp": datetime.now(),
            "reason": reason
        })

    @staticmethod
    def get_active_strikes(user_id: str) -> int:
        if user_id not in user_strikes:
            return 0

        # Count non-expired strikes
        cutoff = datetime.now() - StrikeSystem.STRIKE_EXPIRY
        active = [s for s in user_strikes[user_id] if s["timestamp"] > cutoff]
        user_strikes[user_id] = active
        return len(active)

    @staticmethod
    def is_banned(user_id: str) -> bool:
        return StrikeSystem.get_active_strikes(user_id) >= StrikeSystem.MAX_STRIKES

@app.post("/api/moderate-with-strikes")
async def moderate_with_strikes(request: MessageRequest):
    # Check if user is already banned
    if StrikeSystem.is_banned(request.user_id):
        raise HTTPException(status_code=403, detail="User is banned")

    # Create and moderate message
    message = ChatMessage(
        message_id=generate_message_id(),
        content=request.content,
        user_id=request.user_id
    )

    state = await moderate_message(message)

    # Apply strike system
    if state.recommended_action:
        action = state.recommended_action.action

        if action == ActionType.WARNING:
            StrikeSystem.add_strike(request.user_id, state.recommended_action.reason)

        elif action == ActionType.KICK:
            StrikeSystem.add_strike(request.user_id, state.recommended_action.reason)
            # Auto-ban if too many strikes
            if StrikeSystem.is_banned(request.user_id):
                await ban_user(request.user_id)

        elif action == ActionType.BAN:
            # Immediate ban
            await ban_user(request.user_id)

    strikes = StrikeSystem.get_active_strikes(request.user_id)

    return {
        "approved": state.recommended_action is None,
        "strikes": strikes,
        "max_strikes": StrikeSystem.MAX_STRIKES,
        "action": state.recommended_action.action.value if state.recommended_action else None,
        "reason": state.recommended_action.reason if state.recommended_action else None
    }
```

---

## WebSocket Real-time Chat

### Complete WebSocket Handler

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_websockets: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, chat_id: str, user_id: str):
        await websocket.accept()

        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = set()

        self.active_connections[chat_id].add(websocket)
        self.user_websockets[user_id] = websocket

    def disconnect(self, websocket: WebSocket, chat_id: str, user_id: str):
        self.active_connections[chat_id].discard(websocket)
        if user_id in self.user_websockets:
            del self.user_websockets[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.user_websockets:
            await self.user_websockets[user_id].send_json(message)

    async def broadcast(self, message: dict, chat_id: str, exclude: str = None):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                if exclude and self.user_websockets.get(exclude) == connection:
                    continue
                await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/chat/{chat_id}")
async def websocket_chat(websocket: WebSocket, chat_id: str, user_id: str):
    await manager.connect(websocket, chat_id, user_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            content = data.get("content")

            # Create message object
            message = ChatMessage(
                message_id=generate_message_id(),
                content=content,
                user_id=user_id,
                chat_id=chat_id
            )

            # Moderate message
            state = await moderate_message(message)

            if state.recommended_action:
                # Send warning to user
                await manager.send_personal_message({
                    "type": "moderation_warning",
                    "action": state.recommended_action.action.value,
                    "reason": state.recommended_action.reason,
                    "blocked": True
                }, user_id)

                # Log violation
                await log_violation(user_id, chat_id, state)

                # Handle severe actions
                if state.recommended_action.action == ActionType.KICK:
                    await manager.send_personal_message({
                        "type": "kicked",
                        "reason": state.recommended_action.reason
                    }, user_id)
                    manager.disconnect(websocket, chat_id, user_id)
                    break

                elif state.recommended_action.action == ActionType.BAN:
                    await ban_user(user_id)
                    await manager.send_personal_message({
                        "type": "banned",
                        "reason": state.recommended_action.reason
                    }, user_id)
                    manager.disconnect(websocket, chat_id, user_id)
                    break

            else:
                # Message approved - broadcast
                await manager.broadcast({
                    "type": "message",
                    "message_id": message.message_id,
                    "user_id": user_id,
                    "content": content,
                    "timestamp": datetime.now().isoformat()
                }, chat_id)

                # Save to database
                await save_message(message)

    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user_id)
```

### Rate-Limited Moderation

```python
from collections import defaultdict
from asyncio import Lock

class RateLimiter:
    def __init__(self, max_violations: int = 5, window_seconds: int = 60):
        self.max_violations = max_violations
        self.window_seconds = window_seconds
        self.violations: Dict[str, list] = defaultdict(list)
        self.locks: Dict[str, Lock] = defaultdict(Lock)

    async def check_violation(self, user_id: str) -> bool:
        async with self.locks[user_id]:
            now = datetime.now()
            cutoff = now - timedelta(seconds=self.window_seconds)

            # Remove old violations
            self.violations[user_id] = [
                v for v in self.violations[user_id] if v > cutoff
            ]

            # Check if rate limit exceeded
            if len(self.violations[user_id]) >= self.max_violations:
                return True

            # Add new violation
            self.violations[user_id].append(now)
            return False

rate_limiter = RateLimiter()

@app.websocket("/ws/chat-with-ratelimit/{chat_id}")
async def websocket_chat_ratelimited(websocket: WebSocket, chat_id: str, user_id: str):
    await manager.connect(websocket, chat_id, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            content = data.get("content")

            message = ChatMessage(
                message_id=generate_message_id(),
                content=content,
                user_id=user_id
            )

            state = await moderate_message(message)

            if state.recommended_action:
                # Check rate limit
                if await rate_limiter.check_violation(user_id):
                    await manager.send_personal_message({
                        "type": "rate_limited",
                        "reason": "Too many violations in short time"
                    }, user_id)

                    # Auto-ban for spam
                    await ban_user(user_id)
                    manager.disconnect(websocket, chat_id, user_id)
                    break

                # Send warning
                await manager.send_personal_message({
                    "type": "warning",
                    "reason": state.recommended_action.reason
                }, user_id)

            else:
                # Broadcast message
                await manager.broadcast({
                    "type": "message",
                    "content": content,
                    "user_id": user_id
                }, chat_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user_id)
```

---

## Discord Bot Integration

### Discord.py Bot Example

```python
import discord
from discord.ext import commands
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

class ModerationCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.review_channel_id = 123456789  # Set your review channel ID

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        # Ignore bot messages
        if message.author.bot:
            return

        # Create message object
        chat_message = ChatMessage(
            message_id=str(message.id),
            content=message.content,
            user_id=str(message.author.id)
        )

        # Moderate
        state = await moderate_message(chat_message)

        if state.recommended_action:
            # Delete message
            await message.delete()

            # Send DM to user
            try:
                await message.author.send(
                    f"⚠️ Your message was removed.\n"
                    f"Reason: {state.recommended_action.reason}"
                )
            except discord.Forbidden:
                pass

            # Take action based on severity
            if state.recommended_action.action == ActionType.WARNING:
                # Timeout for 5 minutes
                await message.author.timeout(
                    timedelta(minutes=5),
                    reason=state.recommended_action.reason
                )

            elif state.recommended_action.action == ActionType.KICK:
                # Kick from server
                await message.author.kick(reason=state.recommended_action.reason)

            elif state.recommended_action.action == ActionType.BAN:
                # Ban from server
                await message.author.ban(reason=state.recommended_action.reason)

        # Flag for review if needed
        if state.flag:
            review_channel = self.bot.get_channel(self.review_channel_id)
            if review_channel:
                embed = discord.Embed(
                    title="Message Flagged for Review",
                    description=message.content,
                    color=discord.Color.orange()
                )
                embed.add_field(name="Author", value=message.author.mention)
                embed.add_field(name="Channel", value=message.channel.mention)
                if state.recommended_action:
                    embed.add_field(
                        name="Action",
                        value=state.recommended_action.action.value
                    )
                    embed.add_field(
                        name="Reason",
                        value=state.recommended_action.reason
                    )
                await review_channel.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def checkmod(self, ctx, *, text: str):
        """Manually check text moderation"""
        chat_message = ChatMessage(
            message_id="manual_check",
            content=text,
            user_id=str(ctx.author.id)
        )

        state = await moderate_message(chat_message)

        embed = discord.Embed(title="Moderation Check", color=discord.Color.blue())

        if state.pii_result and state.pii_result.pii_presence:
            embed.add_field(
                name="PII Detected",
                value=f"Type: {state.pii_result.pii_type.value}",
                inline=False
            )

        if state.content_result:
            categories_str = "\n".join([
                f"{cat}: {score:.2%}"
                for cat, score in state.content_result.categories.items()
            ])
            embed.add_field(
                name="Content Analysis",
                value=categories_str,
                inline=False
            )

        if state.recommended_action:
            embed.add_field(
                name="Recommended Action",
                value=f"{state.recommended_action.action.value}\n{state.recommended_action.reason}",
                inline=False
            )
        else:
            embed.add_field(name="Status", value="✅ Content OK", inline=False)

        await ctx.send(embed=embed)

bot.add_cog(ModerationCog(bot))
bot.run("YOUR_BOT_TOKEN")
```

---

## Message Queue Processing

### Celery Task Integration

```python
from celery import Celery
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

celery_app = Celery('moderation_tasks', broker='redis://localhost:6379/0')

@celery_app.task
async def moderate_message_async(message_data: dict):
    """Process moderation asynchronously"""

    message = ChatMessage(**message_data)
    state = await moderate_message(message)

    # Store results
    await store_moderation_result(message.message_id, {
        "approved": state.recommended_action is None,
        "action": state.recommended_action.action.value if state.recommended_action else None,
        "reason": state.recommended_action.reason if state.recommended_action else None,
        "flagged": state.flag
    })

    # Send webhook notification
    if state.recommended_action:
        await send_webhook_notification(message, state)

    return state.dict()

# Usage
@app.post("/api/messages")
async def create_message(request: MessageRequest):
    # Queue moderation task
    task = moderate_message_async.delay(request.dict())

    return {
        "message_id": request.message_id,
        "status": "pending_moderation",
        "task_id": task.id
    }
```

### RabbitMQ Integration

```python
import pika
import json

class ModerationWorker:
    def __init__(self, rabbitmq_url: str):
        self.connection = pika.BlockingConnection(
            pika.URLParameters(rabbitmq_url)
        )
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue='moderation_queue', durable=True)

    async def process_message(self, ch, method, properties, body):
        try:
            data = json.loads(body)
            message = ChatMessage(**data)

            # Moderate
            state = await moderate_message(message)

            # Publish result
            result = {
                "message_id": message.message_id,
                "approved": state.recommended_action is None,
                "action": state.recommended_action.action.value if state.recommended_action else None,
                "flagged": state.flag
            }

            self.channel.basic_publish(
                exchange='',
                routing_key='moderation_results',
                body=json.dumps(result),
                properties=pika.BasicProperties(delivery_mode=2)
            )

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            print(f"Error processing message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def start(self):
        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(
            queue='moderation_queue',
            on_message_callback=self.process_message
        )
        self.channel.start_consuming()

# Start worker
worker = ModerationWorker('amqp://localhost')
worker.start()
```

---

## Database Integration

### SQLAlchemy Models

```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ModerationLog(Base):
    __tablename__ = 'moderation_logs'

    id = Column(Integer, primary_key=True)
    message_id = Column(String, unique=True, nullable=False)
    user_id = Column(String, nullable=False)
    content = Column(String, nullable=False)
    pii_detected = Column(Boolean, default=False)
    pii_type = Column(String, nullable=True)
    content_category = Column(String, nullable=False)
    action_taken = Column(SQLEnum(ActionType), nullable=True)
    action_reason = Column(String, nullable=True)
    flagged = Column(Boolean, default=False)
    categories_scores = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

async def save_moderation_result(message: ChatMessage, state: ModerationState):
    """Save moderation result to database"""

    log = ModerationLog(
        message_id=message.message_id,
        user_id=message.user_id,
        content=message.content,
        pii_detected=state.pii_result.pii_presence if state.pii_result else False,
        pii_type=state.pii_result.pii_type.value if state.pii_result and state.pii_result.pii_type else None,
        content_category=state.content_result.main_category.value if state.content_result else "OK",
        action_taken=state.recommended_action.action if state.recommended_action else None,
        action_reason=state.recommended_action.reason if state.recommended_action else None,
        flagged=state.flag,
        categories_scores=state.content_result.categories if state.content_result else {}
    )

    db.add(log)
    await db.commit()
```

### Query Examples

```python
from sqlalchemy import func, desc

async def get_user_violations(user_id: str, days: int = 7):
    """Get user violations in last N days"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    return await db.query(ModerationLog).filter(
        ModerationLog.user_id == user_id,
        ModerationLog.action_taken.isnot(None),
        ModerationLog.created_at > cutoff
    ).all()

async def get_flagged_messages():
    """Get all messages flagged for review"""
    return await db.query(ModerationLog).filter(
        ModerationLog.flagged == True
    ).order_by(desc(ModerationLog.created_at)).all()

async def get_moderation_stats(days: int = 30):
    """Get moderation statistics"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    stats = await db.query(
        func.count(ModerationLog.id).label('total'),
        func.sum(case((ModerationLog.pii_detected == True, 1), else_=0)).label('pii_detected'),
        func.sum(case((ModerationLog.action_taken.isnot(None), 1), else_=0)).label('actions_taken'),
        func.sum(case((ModerationLog.flagged == True, 1), else_=0)).label('flagged')
    ).filter(ModerationLog.created_at > cutoff).first()

    return stats
```

---

## Admin Dashboard

### Dashboard API Endpoints

```python
@app.get("/api/admin/moderation/stats")
async def get_moderation_dashboard():
    """Get comprehensive moderation statistics"""

    # Last 24 hours
    stats_24h = await get_moderation_stats(days=1)

    # Last 7 days
    stats_7d = await get_moderation_stats(days=7)

    # Top violators
    top_violators = await db.query(
        ModerationLog.user_id,
        func.count(ModerationLog.id).label('violation_count')
    ).filter(
        ModerationLog.action_taken.isnot(None)
    ).group_by(ModerationLog.user_id).order_by(
        desc('violation_count')
    ).limit(10).all()

    # Category breakdown
    category_breakdown = await db.query(
        ModerationLog.content_category,
        func.count(ModerationLog.id).label('count')
    ).group_by(ModerationLog.content_category).all()

    return {
        "stats_24h": stats_24h,
        "stats_7d": stats_7d,
        "top_violators": top_violators,
        "category_breakdown": category_breakdown
    }

@app.get("/api/admin/moderation/flagged")
async def get_flagged_for_review(skip: int = 0, limit: int = 20):
    """Get messages flagged for human review"""

    flagged = await db.query(ModerationLog).filter(
        ModerationLog.flagged == True
    ).order_by(desc(ModerationLog.created_at)).offset(skip).limit(limit).all()

    return {"items": flagged, "total": len(flagged)}

@app.post("/api/admin/moderation/review/{message_id}")
async def review_flagged_message(message_id: str, approved: bool, notes: str = None):
    """Manually review a flagged message"""

    log = await db.query(ModerationLog).filter(
        ModerationLog.message_id == message_id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Message not found")

    # Update log
    log.flagged = False
    log.manual_review = True
    log.manual_review_approved = approved
    log.manual_review_notes = notes
    log.reviewed_at = datetime.utcnow()

    await db.commit()

    return {"message_id": message_id, "approved": approved}
```

---

## Custom Workflows

### Multi-Stage Moderation

```python
async def multi_stage_moderation(message: ChatMessage):
    """
    Stage 1: Quick pre-check
    Stage 2: Full AI analysis
    Stage 3: Human review if needed
    """

    # Stage 1: Quick regex check
    has_obvious_pii = bool(re.search(r'\b\d{3}-\d{2}-\d{4}\b', message.content))

    if has_obvious_pii:
        return {
            "blocked": True,
            "reason": "Obvious PII detected",
            "stage": "pre-check"
        }

    # Stage 2: Full AI moderation
    state = await moderate_message(message)

    if state.recommended_action:
        if state.recommended_action.action == ActionType.BAN:
            # Stage 3: Queue for human review
            await queue_for_human_review(message, state)
            return {
                "blocked": True,
                "reason": "Queued for human review",
                "stage": "human-review"
            }

        return {
            "blocked": True,
            "reason": state.recommended_action.reason,
            "stage": "ai-moderation"
        }

    return {"blocked": False, "stage": "approved"}
```

### Whitelist/Blacklist System

```python
class ContentFilter:
    def __init__(self):
        self.whitelisted_users = set()
        self.blacklisted_phrases = set()

    async def moderate_with_lists(self, message: ChatMessage):
        # Check whitelist
        if message.user_id in self.whitelisted_users:
            return {"blocked": False, "reason": "Whitelisted user"}

        # Check blacklist
        content_lower = message.content.lower()
        for phrase in self.blacklisted_phrases:
            if phrase in content_lower:
                return {
                    "blocked": True,
                    "reason": f"Blacklisted phrase detected: {phrase}"
                }

        # Run AI moderation
        state = await moderate_message(message)

        return {
            "blocked": state.recommended_action is not None,
            "action": state.recommended_action.action.value if state.recommended_action else None,
            "reason": state.recommended_action.reason if state.recommended_action else None
        }

filter_system = ContentFilter()
```

---

## Testing

### Pytest Examples

```python
import pytest
from backend.agents.moderation import moderate_message

@pytest.mark.asyncio
async def test_pii_email():
    message = ChatMessage(
        message_id="test_1",
        content="Contact me at john@example.com",
        user_id="test_user"
    )

    state = await moderate_message(message)

    assert state.pii_result.pii_presence is True
    assert state.pii_result.pii_type == PIIType.EMAIL
    assert state.recommended_action.action == ActionType.WARNING

@pytest.mark.asyncio
async def test_hate_speech():
    message = ChatMessage(
        message_id="test_2",
        content="hateful content example",
        user_id="test_user"
    )

    state = await moderate_message(message)

    assert state.content_result.main_category != ContentType.OK
    assert state.recommended_action is not None

@pytest.mark.asyncio
async def test_safe_content():
    message = ChatMessage(
        message_id="test_3",
        content="Hello, how are you today?",
        user_id="test_user"
    )

    state = await moderate_message(message)

    assert state.pii_result.pii_presence is False
    assert state.content_result.main_category == ContentType.OK
    assert state.recommended_action is None
```

---

*For more information, see [AI_MODERATION_GUIDE.md](AI_MODERATION_GUIDE.md)*
