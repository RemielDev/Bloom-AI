# AI Moderation System - Developer Guide

Simple, practical guide for integrating AI moderation into your application.

## Quick Start (2 minutes)

### 1. Setup Environment

```bash
# Add to .env file
HF_TOKEN=your_huggingface_token_here
```

### 2. Basic Usage

```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

# Moderate a message
message = ChatMessage(
    message_id="msg_123",
    content="User message here",
    user_id="user_456"
)

state = await moderate_message(message)

# Check if action needed
if state.recommended_action:
    print(f"⚠️ {state.recommended_action.action}: {state.recommended_action.reason}")

# Check if needs human review
if state.flag:
    print("🚩 Flagged for manual review")
```

That's it! You're now moderating content.

---

## What It Detects

### Personal Information (PII)
- Emails, phone numbers, credit cards
- Social security numbers, driver's licenses
- Names, addresses, dates of birth
- Passwords, usernames, account numbers

### Harmful Content
- Sexual content
- Hate speech
- Violence
- Harassment

---

## Common Use Cases

### 1. Block Inappropriate Messages

```python
async def send_message(content: str, user_id: str):
    message = ChatMessage(
        message_id=generate_id(),
        content=content,
        user_id=user_id
    )

    state = await moderate_message(message)

    if state.recommended_action:
        return {"blocked": True, "reason": state.recommended_action.reason}

    # Safe to send
    await broadcast_message(message)
    return {"blocked": False}
```

### 2. Warn Users About PII

```python
async def check_for_pii(content: str):
    message = ChatMessage(message_id="check", content=content, user_id="temp")
    state = await moderate_message(message)

    if state.pii_result and state.pii_result.pii_presence:
        return {
            "has_pii": True,
            "type": state.pii_result.pii_type.value,
            "warning": "Don't share personal information publicly"
        }

    return {"has_pii": False}
```

### 3. Auto-Moderate Chat (FastAPI + WebSocket)

```python
from fastapi import WebSocket

@app.websocket("/ws/chat")
async def chat(websocket: WebSocket, user_id: str):
    await websocket.accept()

    while True:
        data = await websocket.receive_json()
        message = ChatMessage(
            message_id=generate_id(),
            content=data["content"],
            user_id=user_id
        )

        state = await moderate_message(message)

        if state.recommended_action:
            # Send warning to user
            await websocket.send_json({
                "type": "warning",
                "message": state.recommended_action.reason
            })
        else:
            # Broadcast to everyone
            await broadcast(message)
```

### 4. Process Batch Messages

```python
async def moderate_batch(messages: list[str]):
    results = await asyncio.gather(*[
        moderate_message(ChatMessage(
            message_id=f"msg_{i}",
            content=msg,
            user_id="batch"
        ))
        for i, msg in enumerate(messages)
    ])

    return [
        {"content": msg, "safe": result.recommended_action is None}
        for msg, result in zip(messages, results)
    ]
```

---

## Understanding the Response

### ModerationState Fields

```python
state = await moderate_message(message)

# Check PII detection
if state.pii_result:
    state.pii_result.pii_presence    # bool - was PII found?
    state.pii_result.pii_type        # PIIType - EMAIL, PHONE, etc.
    state.pii_result.pii_intent      # bool - does user want to share it?

# Check content classification
if state.content_result:
    state.content_result.main_category    # ContentType - OK, S, H, V, etc.
    state.content_result.categories       # dict - all scores

# Check recommended action
if state.recommended_action:
    state.recommended_action.action       # ActionType - WARNING, KICK, BAN
    state.recommended_action.reason       # str - explanation

# Check if needs manual review
state.flag    # bool - should a human review this?
```

### Action Types

| Action | When Used | What To Do |
|--------|-----------|------------|
| `WARNING` | PII detected, mild violations | Warn user, may block message |
| `KICK` | Serious violations | Remove from chat/conversation |
| `BAN` | Severe violations | Ban user, notify admins |

---

## Integration Patterns

### REST API

```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/api/moderate")
async def moderate(content: str, user_id: str):
    message = ChatMessage(
        message_id=generate_id(),
        content=content,
        user_id=user_id
    )

    state = await moderate_message(message)

    return {
        "approved": state.recommended_action is None,
        "action": state.recommended_action.action.value if state.recommended_action else None,
        "reason": state.recommended_action.reason if state.recommended_action else None,
        "needs_review": state.flag
    }
```

### Discord Bot

```python
import discord
from discord.ext import commands

bot = commands.Bot(command_prefix="!")

@bot.event
async def on_message(message):
    if message.author.bot:
        return

    chat_msg = ChatMessage(
        message_id=str(message.id),
        content=message.content,
        user_id=str(message.author.id)
    )

    state = await moderate_message(chat_msg)

    if state.recommended_action:
        await message.delete()
        await message.author.send(f"⚠️ Message removed: {state.recommended_action.reason}")

        if state.recommended_action.action == ActionType.KICK:
            await message.author.kick(reason=state.recommended_action.reason)
```

### Background Processing

```python
from celery import Celery

celery_app = Celery('tasks', broker='redis://localhost')

@celery_app.task
async def moderate_async(message_data: dict):
    message = ChatMessage(**message_data)
    state = await moderate_message(message)

    if state.recommended_action:
        await handle_violation(message, state)

    return state.dict()
```

---

## Advanced Usage

### Custom Confidence Thresholds

```python
async def moderate_with_threshold(content: str, threshold: float = 0.8):
    message = ChatMessage(message_id="check", content=content, user_id="temp")
    state = await moderate_message(message)

    if state.content_result:
        # Only act if confidence is high
        harmful = {
            cat: score
            for cat, score in state.content_result.categories.items()
            if cat != "OK" and score > threshold
        }

        if harmful:
            return {"blocked": True, "categories": harmful}

    return {"blocked": False}
```

### User Strike System

```python
from datetime import datetime, timedelta

user_strikes = {}

async def moderate_with_strikes(message: ChatMessage, max_strikes: int = 3):
    state = await moderate_message(message)

    if state.recommended_action:
        # Add strike
        if message.user_id not in user_strikes:
            user_strikes[message.user_id] = []

        user_strikes[message.user_id].append({
            "timestamp": datetime.now(),
            "reason": state.recommended_action.reason
        })

        # Check if should ban
        recent_strikes = [
            s for s in user_strikes[message.user_id]
            if s["timestamp"] > datetime.now() - timedelta(days=7)
        ]

        if len(recent_strikes) >= max_strikes:
            await ban_user(message.user_id)

    return state
```

### Database Logging

```python
async def moderate_and_log(message: ChatMessage):
    state = await moderate_message(message)

    # Log to database
    await db.moderation_logs.insert({
        "message_id": message.message_id,
        "user_id": message.user_id,
        "content": message.content,
        "pii_detected": state.pii_result.pii_presence if state.pii_result else False,
        "action": state.recommended_action.action.value if state.recommended_action else None,
        "flagged": state.flag,
        "timestamp": datetime.now()
    })

    return state
```

---

## Using Individual Components

### Just PII Detection

```python
from backend.agents.moderation.nodes import detect_pii

pii_entities = await detect_pii("My email is john@example.com")

for entity in pii_entities:
    print(f"Found {entity['entity_group']}: {entity['word']}")
```

### Just Content Moderation

```python
from backend.agents.moderation.nodes import moderate_content

categories = await moderate_content("Message content here")

main = max(categories, key=lambda x: x['score'])
print(f"Main category: {main['label']} ({main['score']:.2%})")
```

---

## Configuration

### Environment Variables

```bash
# Required
HF_TOKEN=your_huggingface_token

# Optional - defaults shown
API_TIMEOUT=30  # seconds
```

### Adjusting Timeouts

In `backend/agents/moderation/nodes.py`:

```python
API_TIMEOUT = 60  # Increase if needed
```

---

## Error Handling

```python
async def safe_moderate(message: ChatMessage):
    try:
        state = await moderate_message(message)
        return state

    except Exception as e:
        logger.error(f"Moderation failed: {e}")

        # Default to blocking on error
        return ModerationState(
            message=message,
            recommended_action=ModAction(
                action=ActionType.WARNING,
                reason="Moderation service error - manual review required"
            ),
            flag=True
        )
```

---

## Testing

```python
import pytest

@pytest.mark.asyncio
async def test_pii_detection():
    msg = ChatMessage(
        message_id="test",
        content="My email is test@example.com",
        user_id="test"
    )

    state = await moderate_message(msg)

    assert state.pii_result.pii_presence is True
    assert state.recommended_action.action == ActionType.WARNING

@pytest.mark.asyncio
async def test_safe_content():
    msg = ChatMessage(
        message_id="test",
        content="Hello, how are you?",
        user_id="test"
    )

    state = await moderate_message(msg)

    assert state.recommended_action is None
```

---

## Troubleshooting

### "Unauthorized" Error
```bash
# Check your HuggingFace token
echo $HF_TOKEN

# Make sure it's in .env
HF_TOKEN=hf_your_token_here
```

### Timeout Issues
```python
# Increase timeout in nodes.py
API_TIMEOUT = 60
```

### False Positives
```python
# Use confidence thresholds
if state.content_result:
    max_score = max(state.content_result.categories.values())
    if max_score < 0.9:  # Require high confidence
        state.recommended_action = None
```

---

## Performance Tips

1. **Batch Processing**: Use `asyncio.gather()` for multiple messages
   ```python
   results = await asyncio.gather(*[moderate_message(m) for m in messages])
   ```

2. **Caching**: Cache results for identical content
   ```python
   from functools import lru_cache

   @lru_cache(maxsize=1000)
   def cached_moderate(content_hash: str):
       # Return cached result
       pass
   ```

3. **Background Jobs**: Use Celery/RabbitMQ for async processing

---

## Complete Example: Moderated Chat API

```python
from fastapi import FastAPI, WebSocket, HTTPException
from typing import Dict, Set

app = FastAPI()

class ChatManager:
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, room: str):
        await ws.accept()
        if room not in self.connections:
            self.connections[room] = set()
        self.connections[room].add(ws)

    async def broadcast(self, room: str, message: dict):
        if room in self.connections:
            for ws in self.connections[room]:
                await ws.send_json(message)

manager = ChatManager()

@app.websocket("/chat/{room_id}")
async def chat_room(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, room_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()

            # Create message object
            message = ChatMessage(
                message_id=generate_id(),
                content=data["content"],
                user_id=user_id
            )

            # Moderate
            state = await moderate_message(message)

            if state.recommended_action:
                # Send warning to sender only
                await websocket.send_json({
                    "type": "warning",
                    "message": state.recommended_action.reason
                })

                # Log violation
                await log_violation(user_id, state)

            else:
                # Broadcast to room
                await manager.broadcast(room_id, {
                    "type": "message",
                    "user_id": user_id,
                    "content": data["content"],
                    "timestamp": datetime.now().isoformat()
                })

    except WebSocketDisconnect:
        manager.connections[room_id].discard(websocket)
```

---

## Need More Details?

For comprehensive documentation including architecture details, all API methods, and advanced patterns:

- **Full API Reference**: [MODERATION_API_REFERENCE.md](MODERATION_API_REFERENCE.md)
- **Integration Examples**: [MODERATION_INTEGRATION_EXAMPLES.md](MODERATION_INTEGRATION_EXAMPLES.md)
- **Complete Guide**: [AI_MODERATION_GUIDE.md](AI_MODERATION_GUIDE.md)

---

## Quick Reference

```python
# Main imports
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

# Basic usage
state = await moderate_message(message)

# Check results
state.pii_result          # PII detection
state.content_result      # Content classification
state.recommended_action  # Suggested action
state.flag                # Needs human review?

# Action types
ActionType.WARNING  # Warn user
ActionType.KICK     # Remove from chat
ActionType.BAN      # Ban user
```

---

*This documentation covers 90% of use cases. For advanced scenarios, see the full documentation.*
