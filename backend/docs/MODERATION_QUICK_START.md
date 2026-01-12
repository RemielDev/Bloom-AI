# AI Moderation Quick Start Guide

## 5-Minute Setup

### Step 1: Environment Setup

```bash
# Set your HuggingFace token
export HF_TOKEN="hf_your_token_here"

# Or add to .env file
echo "HF_TOKEN=hf_your_token_here" >> .env
```

### Step 2: Basic Usage

```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

async def moderate(content: str):
    message = ChatMessage(
        message_id="msg_123",
        content=content,
        user_id="user_456"
    )

    result = await moderate_message(message)

    # Check if action needed
    if result.recommended_action:
        print(f"⚠️ Action: {result.recommended_action.action.value}")
        print(f"Reason: {result.recommended_action.reason}")

    # Check if needs human review
    if result.flag:
        print("🚩 Flagged for human review")

    return result
```

### Step 3: Integration Examples

#### Example 1: Chat Application

```python
async def handle_chat_message(message_content: str, user_id: str):
    message = ChatMessage(
        message_id=generate_id(),
        content=message_content,
        user_id=user_id
    )

    # Moderate before sending
    state = await moderate_message(message)

    if state.recommended_action:
        if state.recommended_action.action == ActionType.WARNING:
            return {
                "blocked": True,
                "message": "Your message contains inappropriate content.",
                "details": state.recommended_action.reason
            }
        elif state.recommended_action.action in [ActionType.KICK, ActionType.BAN]:
            await ban_user(user_id)
            return {"blocked": True, "message": "User banned"}

    # Message is safe, send it
    await send_message(message)
    return {"blocked": False}
```

#### Example 2: Comment Moderation

```python
async def moderate_comment(comment_text: str, author_id: str):
    message = ChatMessage(
        message_id=generate_id(),
        content=comment_text,
        user_id=author_id
    )

    state = await moderate_message(message)

    if state.pii_result and state.pii_result.pii_presence:
        return {
            "approved": False,
            "reason": "Comment contains personal information"
        }

    if state.content_result.main_category != ContentType.OK:
        if state.flag:
            # Queue for manual review
            await queue_for_review(comment_text, state)
            return {
                "approved": False,
                "reason": "Comment pending review"
            }

    return {"approved": True}
```

#### Example 3: Real-time Filtering

```python
from fastapi import WebSocket

async def websocket_chat(websocket: WebSocket):
    await websocket.accept()

    while True:
        # Receive message
        data = await websocket.receive_json()
        content = data.get("message")

        # Create message object
        message = ChatMessage(
            message_id=generate_id(),
            content=content,
            user_id=data.get("user_id")
        )

        # Moderate
        state = await moderate_message(message)

        if state.recommended_action:
            # Send warning to user
            await websocket.send_json({
                "type": "warning",
                "message": state.recommended_action.reason
            })
        else:
            # Broadcast to all users
            await broadcast_message(message)
```

## Common Patterns

### Pattern 1: Simple Block/Allow

```python
async def should_block(content: str) -> bool:
    message = ChatMessage(
        message_id=generate_id(),
        content=content,
        user_id="system"
    )

    state = await moderate_message(message)
    return state.recommended_action is not None
```

### Pattern 2: Confidence-Based Filtering

```python
async def moderate_with_confidence(content: str, threshold: float = 0.8):
    message = ChatMessage(
        message_id=generate_id(),
        content=content,
        user_id="system"
    )

    state = await moderate_message(message)

    if state.content_result:
        harmful_scores = [
            score for cat, score in state.content_result.categories.items()
            if cat != "OK" and score > threshold
        ]

        if harmful_scores:
            return {
                "blocked": True,
                "confidence": max(harmful_scores),
                "categories": [
                    cat for cat, score in state.content_result.categories.items()
                    if score > threshold
                ]
            }

    return {"blocked": False}
```

### Pattern 3: Batch Processing

```python
async def moderate_multiple(messages: list[str]):
    results = await asyncio.gather(*[
        moderate_message(ChatMessage(
            message_id=f"msg_{i}",
            content=content,
            user_id="batch_user"
        ))
        for i, content in enumerate(messages)
    ])

    return [
        {
            "content": msg,
            "safe": result.recommended_action is None,
            "needs_review": result.flag
        }
        for msg, result in zip(messages, results)
    ]
```

## Detection Reference

### PII Detection

```python
# Will detect:
"My email is john@example.com"              # EMAIL
"Call me at 555-123-4567"                   # TELEPHONENUM
"My SSN is 123-45-6789"                     # SOCIALNUM
"Credit card: 4111-1111-1111-1111"          # CREDITCARDNUMBER
```

### Content Detection

```python
# Sexual content
"Explicit sexual message"                   # Category: S

# Hate speech
"Hateful message targeting groups"          # Category: H

# Violence
"Threatening violent message"               # Category: V

# Safe content
"Hello, how are you?"                       # Category: OK
```

## Testing Your Integration

```python
import pytest

@pytest.mark.asyncio
async def test_pii_blocked():
    content = "My email is test@example.com"
    result = await should_block(content)
    assert result is True

@pytest.mark.asyncio
async def test_safe_content():
    content = "Hello, nice to meet you!"
    result = await should_block(content)
    assert result is False

@pytest.mark.asyncio
async def test_hate_speech():
    content = "Hateful message example"
    message = ChatMessage(
        message_id="test",
        content=content,
        user_id="test"
    )
    state = await moderate_message(message)
    assert state.content_result.main_category != ContentType.OK
```

## Performance Tips

1. **Use asyncio.gather for parallel processing**
   ```python
   results = await asyncio.gather(*[moderate_message(m) for m in messages])
   ```

2. **Cache results for identical content**
   ```python
   from functools import lru_cache

   @lru_cache(maxsize=1000)
   def get_cached_result(content_hash: str):
       # Return cached moderation result
       pass
   ```

3. **Set appropriate timeouts**
   ```python
   # In nodes.py
   API_TIMEOUT = 30  # Adjust based on your needs
   ```

## Error Handling

```python
async def safe_moderate(content: str):
    try:
        message = ChatMessage(
            message_id=generate_id(),
            content=content,
            user_id="system"
        )

        state = await moderate_message(message)
        return state

    except Exception as e:
        logger.error(f"Moderation error: {e}")
        # Default to blocking on error
        return ModerationState(
            message=message,
            recommended_action=ModAction(
                action=ActionType.WARNING,
                reason="Moderation service unavailable"
            ),
            flag=True  # Flag for manual review
        )
```

## Next Steps

1. Read the [full documentation](AI_MODERATION_GUIDE.md)
2. Explore the [integration examples](MODERATION_INTEGRATION_EXAMPLES.md)
3. Review the [source code](../agents/moderation/nodes.py)
4. Test with your own content

## Support

- Check [troubleshooting guide](AI_MODERATION_GUIDE.md#troubleshooting)
- Review code examples above
- Enable debug logging for detailed errors

---

*For comprehensive documentation, see [AI_MODERATION_GUIDE.md](AI_MODERATION_GUIDE.md)*
