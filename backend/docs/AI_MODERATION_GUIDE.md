# AI Moderation System Documentation

## Overview

The Bloom AI Moderation System is a comprehensive, AI-powered content moderation solution that automatically detects and handles inappropriate content, personally identifiable information (PII), and other policy violations in real-time. The system leverages multiple AI models and provides actionable recommendations for content management.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Usage Guide](#usage-guide)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Detection Categories](#detection-categories)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Features

### 🛡️ Core Capabilities

- **PII Detection**: Identifies and flags 17 types of personally identifiable information
- **Content Moderation**: Classifies content into harmful categories (sexual, hate speech, violence, etc.)
- **Intent Analysis**: Uses AI to determine if users intend to share sensitive information
- **Action Recommendations**: Provides automated moderation actions (WARNING, KICK, BAN)
- **Human Review Flagging**: Automatically flags ambiguous or severe cases for manual review
- **Fallback Mechanisms**: Regex-based backup detection when AI services are unavailable
- **Async Processing**: Non-blocking asynchronous operation for high performance

### 🎯 Detection Types

1. **PII (Personally Identifiable Information)**
   - Email addresses, phone numbers, credit cards
   - Social security numbers, driver's licenses
   - Names, addresses, dates of birth
   - Account numbers, passwords, usernames

2. **Content Categories**
   - Sexual content (S, S3)
   - Hate speech (H, H2)
   - Violence (V, V2)
   - Harassment (HR)
   - Combined violations (SH)

---

## Architecture

### System Flow

```
Message Input
    ↓
StartModeration Node
    ↓
    ├─→ PII Detection (AI + Regex Fallback)
    ├─→ Intent Analysis (Gemini 2.0 Flash)
    ├─→ Content Moderation (AI Classification)
    └─→ Action Determination (AI Decision)
    ↓
ModerationState Output
    ↓
Action + Human Review Flag
```

### Components

#### 1. **State Management** ([state.py](../agents/moderation/state.py))

Defines the data structures used throughout the moderation pipeline:

- `ModerationState`: Main state container
- `PIIResult`: PII detection results
- `ContentResult`: Content classification results
- `ModAction`: Recommended moderation actions

#### 2. **Detection Nodes** ([nodes.py](../agents/moderation/nodes.py))

Core processing logic:

- `StartModeration`: Main orchestrator node
- API functions for external AI services
- AI agents for intent and action analysis

#### 3. **Graph Execution** ([graph.py](../agents/moderation/graph.py))

Entry point for moderation:

- `moderate_message()`: Main function to moderate a message
- Error handling and logging

---

## Getting Started

### Prerequisites

```bash
# Required environment variables
HF_TOKEN=your_huggingface_token
```

### Installation

```python
# Import the moderation system
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage
```

### Basic Usage

```python
import asyncio
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

async def moderate_user_message():
    # Create a chat message
    message = ChatMessage(
        message_id="msg_123",
        content="Hey, my email is user@example.com",
        user_id="user_456",
        timestamp=datetime.now()
    )

    # Run moderation
    result = await moderate_message(message)

    # Check results
    if result.recommended_action:
        print(f"Action: {result.recommended_action.action}")
        print(f"Reason: {result.recommended_action.reason}")

    if result.flag:
        print("⚠️ Flagged for human review")

    return result

# Run the moderation
asyncio.run(moderate_user_message())
```

---

## Usage Guide

### Method 1: Direct Function Call

The simplest way to use the moderation system:

```python
from backend.agents.moderation import moderate_message

async def check_message(message):
    # Automatically runs all moderation checks
    state = await moderate_message(message)

    # Access results
    has_pii = state.pii_result and state.pii_result.pii_presence
    is_harmful = state.content_result and state.content_result.main_category != ContentType.OK
    needs_action = state.recommended_action is not None
    needs_review = state.flag

    return state
```

### Method 2: Using Individual Components

For custom workflows:

```python
from backend.agents.moderation.nodes import StartModeration
from backend.agents.moderation.state import ModerationState

async def custom_moderation(message):
    # Create state
    state = ModerationState(message=message)

    # Run moderation node
    moderator = StartModeration()
    result = await moderator.run(state)

    # Custom logic based on results
    if result.pii_result.pii_presence:
        # Handle PII detection
        pass

    return result
```

### Method 3: Using Individual Detection APIs

For specialized use cases:

```python
from backend.agents.moderation.nodes import detect_pii, moderate_content

async def check_content_only(text: str):
    # Run only content moderation
    content_data = await moderate_content(text)

    # Process results
    for item in content_data:
        category = item.get("label")
        score = item.get("score")
        print(f"{category}: {score:.2%}")

    return content_data

async def check_pii_only(text: str):
    # Run only PII detection
    pii_data = await detect_pii(text)

    # Check for specific PII types
    for entity in pii_data:
        if isinstance(entity, dict):
            pii_type = entity.get("entity_group")
            text = entity.get("word")
            print(f"Found {pii_type}: {text}")

    return pii_data
```

---

## API Reference

### Main Function

#### `moderate_message(message: ChatMessage) -> ModerationState`

Primary entry point for message moderation.

**Parameters:**
- `message` (ChatMessage): Message object to moderate

**Returns:**
- `ModerationState`: Complete moderation analysis

**Example:**
```python
state = await moderate_message(message)
```

---

### Core Detection Functions

#### `detect_pii(text: str) -> list`

Detects personally identifiable information using AI.

**Parameters:**
- `text` (str): Text content to analyze

**Returns:**
- `list`: Array of detected PII entities with entity_group and word

**Example:**
```python
pii_entities = await detect_pii("My email is john@example.com")
# Returns: [{"entity_group": "EMAIL", "word": "john@example.com", ...}]
```

---

#### `moderate_content(text: str) -> list`

Classifies content into moderation categories.

**Parameters:**
- `text` (str): Text content to analyze

**Returns:**
- `list`: Array of categories with labels and confidence scores

**Example:**
```python
categories = await moderate_content("This is inappropriate content")
# Returns: [{"label": "S", "score": 0.95}, {"label": "OK", "score": 0.05}]
```

---

### AI Agents

#### `PIIAgent`

Analyzes user intent to share personal information.

**Model:** `google-gla:gemini-2.0-flash`

**Output:** `bool` (True if intent detected)

**Usage:**
```python
from backend.agents.moderation.nodes import PIIAgent

result = await PIIAgent.run("I want to share my phone number")
intent = result.output  # True or False
```

---

#### `ModAgent`

Determines appropriate moderation action for harmful content.

**Model:** `google-gla:gemini-2.0-flash`

**Output:** `ModAction` (action type and reason)

**Usage:**
```python
from backend.agents.moderation.nodes import ModAgent

prompt = "Content type: H, Message: hate speech example"
result = await ModAgent.run(prompt)
action = result.output  # ModAction(action=ActionType.BAN, reason="...")
```

---

### Data Models

#### `ModerationState`

Main state container for moderation results.

**Fields:**
- `message` (ChatMessage): Original message
- `pii_result` (PIIResult | None): PII detection results
- `content_result` (ContentResult | None): Content classification results
- `recommended_action` (ModAction | None): Suggested moderation action
- `flag` (bool): Whether to flag for human review

---

#### `PIIResult`

PII detection results.

**Fields:**
- `pii_presence` (bool): Whether PII was detected
- `pii_type` (PIIType | None): Type of PII detected
- `pii_intent` (bool | None): Whether user intends to share PII

---

#### `ContentResult`

Content moderation results.

**Fields:**
- `main_category` (ContentType): Primary content classification
- `categories` (Dict[str, float]): All categories with confidence scores

---

#### `ModAction`

Recommended moderation action.

**Fields:**
- `action` (ActionType): Action to take (WARNING, KICK, BAN)
- `reason` (str): Explanation for the action

---

## Configuration

### Environment Variables

```bash
# Required
HF_TOKEN=hf_your_huggingface_api_token_here
```

### Configuration Constants

Located in [nodes.py](../agents/moderation/nodes.py:26-47):

```python
# API Endpoints
PII_DETECTION_API_URL = "https://router.huggingface.co/..."
CONTENT_MODERATION_API_URL = "https://router.huggingface.co/..."

# AI Models
GEMINI_MODEL = "google-gla:gemini-2.0-flash"

# API Configuration
API_TIMEOUT = 30  # seconds

# Default Responses (fallback values)
DEFAULT_PII_RESPONSE = []
DEFAULT_CONTENT_RESPONSE = [{"label": "OK", "score": 1.0}]
```

### Customizing Prompts

```python
# PII Intent Detection
PII_INTENT_PROMPT = "Analyze if the message contains intent to share personal information. Return only true or false."

# Moderation Action
MODERATION_ACTION_PROMPT = (
    "Determine the appropriate moderation action for harmful content. "
    "Available actions: WARNING (for mild violations), "
    "KICK (for serious violations), "
    "BAN (for severe violations requiring human review). "
    "Return the action and reason."
)
```

---

## Detection Categories

### PII Types (PIIType Enum)

| Type | Description | Example |
|------|-------------|---------|
| EMAIL | Email addresses | user@example.com |
| TELEPHONENUM | Phone numbers | (555) 123-4567 |
| CREDITCARDNUMBER | Credit card numbers | 4111-1111-1111-1111 |
| SOCIALNUM | Social security numbers | 123-45-6789 |
| DATEOFBIRTH | Birth dates | 01/15/1990 |
| PASSWORD | Passwords | myP@ssw0rd |
| USERNAME | Usernames | john_doe123 |
| GIVENNAME | First names | John |
| SURNAME | Last names | Smith |
| STREET | Street addresses | 123 Main St |
| CITY | City names | Springfield |
| ZIPCODE | ZIP codes | 12345 |
| BUILDINGNUM | Building numbers | Apt 4B |
| ACCOUNTNUM | Account numbers | ACC-123456 |
| DRIVERLICENSENUM | Driver's license | D1234567 |
| IDCARDNUM | ID card numbers | ID-987654 |
| TAXNUM | Tax ID numbers | TAX-123456 |

### Content Categories (ContentType Enum)

| Category | Description |
|----------|-------------|
| OK | Safe content |
| S | Sexual content |
| H | Hate speech |
| V | Violence |
| HR | Harassment |
| SH | Sexual + Hate speech |
| S3 | Severe sexual content |
| H2 | Severe hate speech |
| V2 | Severe violence |

### Action Types (ActionType Enum)

| Action | When Applied | Impact |
|--------|--------------|--------|
| WARNING | Mild violations, PII detected | User warned, message may be blocked |
| KICK | Serious violations | User removed from conversation |
| BAN | Severe violations | User banned, requires human review |

---

## Best Practices

### 1. Error Handling

Always handle potential failures gracefully:

```python
try:
    state = await moderate_message(message)

    if state.flag:
        # Send to human moderator queue
        await queue_for_review(message, state)

    if state.recommended_action:
        # Apply moderation action
        await apply_action(message.user_id, state.recommended_action)

except Exception as e:
    logger.error(f"Moderation failed: {e}")
    # Default to manual review on error
    await queue_for_review(message, None)
```

### 2. Logging and Monitoring

Implement comprehensive logging:

```python
import logging

logger = logging.getLogger(__name__)

async def moderate_with_logging(message):
    logger.info(f"Starting moderation for message {message.message_id}")

    state = await moderate_message(message)

    if state.pii_result.pii_presence:
        logger.warning(f"PII detected: {state.pii_result.pii_type}")

    if state.recommended_action:
        logger.warning(
            f"Action recommended: {state.recommended_action.action.value} "
            f"- {state.recommended_action.reason}"
        )

    return state
```

### 3. Human Review Integration

Implement a flagging system:

```python
async def handle_moderation(message):
    state = await moderate_message(message)

    # Automatic flagging conditions
    should_flag = (
        state.flag or  # System flagged
        (state.recommended_action and
         state.recommended_action.action in [ActionType.BAN, ActionType.KICK]) or
        (state.pii_result and state.pii_result.pii_presence)
    )

    if should_flag:
        await add_to_review_queue(message, state)

    return state
```

### 4. Performance Optimization

Use batching for multiple messages:

```python
async def moderate_batch(messages: list[ChatMessage]):
    # Process in parallel
    tasks = [moderate_message(msg) for msg in messages]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle results
    for message, result in zip(messages, results):
        if isinstance(result, Exception):
            logger.error(f"Failed to moderate {message.message_id}: {result}")
            continue

        # Process successful result
        if result.recommended_action:
            await apply_action(message, result)
```

### 5. Custom Thresholds

Implement custom confidence thresholds:

```python
async def moderate_with_threshold(message, threshold=0.7):
    state = await moderate_message(message)

    if state.content_result:
        # Check if any harmful category exceeds threshold
        harmful_categories = {
            cat: score
            for cat, score in state.content_result.categories.items()
            if cat != "OK" and score > threshold
        }

        if harmful_categories:
            logger.warning(f"High confidence violations: {harmful_categories}")
            # Take action
            await handle_violation(message, harmful_categories)

    return state
```

### 6. Testing

Create comprehensive test cases:

```python
import pytest

@pytest.mark.asyncio
async def test_pii_detection():
    message = ChatMessage(
        message_id="test_1",
        content="My email is test@example.com",
        user_id="user_1"
    )

    state = await moderate_message(message)

    assert state.pii_result.pii_presence is True
    assert state.pii_result.pii_type == PIIType.EMAIL
    assert state.recommended_action.action == ActionType.WARNING

@pytest.mark.asyncio
async def test_safe_content():
    message = ChatMessage(
        message_id="test_2",
        content="Hello, how are you today?",
        user_id="user_2"
    )

    state = await moderate_message(message)

    assert state.pii_result.pii_presence is False
    assert state.content_result.main_category == ContentType.OK
    assert state.recommended_action is None
```

---

## Troubleshooting

### Common Issues

#### 1. API Timeouts

**Problem:** Moderation requests timeout

**Solution:**
```python
# Adjust timeout in nodes.py
API_TIMEOUT = 60  # Increase to 60 seconds
```

#### 2. HuggingFace Token Issues

**Problem:** "Unauthorized" errors

**Solution:**
```bash
# Verify token is set
echo $HF_TOKEN

# Set in .env file
HF_TOKEN=hf_your_token_here

# Reload environment
source .env
```

#### 3. False Positives

**Problem:** Safe content flagged as harmful

**Solution:**
```python
# Implement confidence threshold checking
if state.content_result:
    max_score = max(state.content_result.categories.values())
    if max_score < 0.8:  # Require high confidence
        # Skip action
        state.recommended_action = None
```

#### 4. Missing PII Detection

**Problem:** PII not detected

**Solution:**
- The system uses AI first, then regex fallback
- Check if the PII format is supported
- Add custom regex patterns if needed:

```python
# In nodes.py _check_pii method, add custom patterns
pii_patterns = {
    PIIType.EMAIL: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    PIIType.TELEPHONENUM: r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
    # Add custom pattern
    PIIType.CUSTOM: r'your_regex_pattern_here',
}
```

#### 5. Slow Performance

**Problem:** Moderation takes too long

**Solution:**
```python
# Use asyncio.gather for parallel processing
async def moderate_multiple(messages):
    results = await asyncio.gather(
        *[moderate_message(msg) for msg in messages]
    )
    return results
```

### Debug Mode

Enable detailed logging:

```python
import logging

# Set debug level
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('backend.agents.moderation')
logger.setLevel(logging.DEBUG)

# Run moderation
state = await moderate_message(message)
```

### Health Check

Verify system is working:

```python
async def health_check():
    """Test all moderation components"""
    test_message = ChatMessage(
        message_id="health_check",
        content="Test message",
        user_id="system"
    )

    try:
        state = await moderate_message(test_message)
        return {
            "status": "healthy",
            "pii_check": "ok",
            "content_check": "ok",
            "ai_agents": "ok"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

---

## Additional Resources

### File References

- Main Implementation: [backend/agents/moderation/nodes.py](../agents/moderation/nodes.py)
- State Definitions: [backend/agents/moderation/state.py](../agents/moderation/state.py)
- Graph Execution: [backend/agents/moderation/graph.py](../agents/moderation/graph.py)
- Package Exports: [backend/agents/moderation/__init__.py](../agents/moderation/__init__.py)

### External Services

- **PII Detection Model**: [iiiorg/piiranha-v1-detect-personal-information](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information)
- **Content Moderation Model**: [KoalaAI/Text-Moderation](https://huggingface.co/KoalaAI/Text-Moderation)
- **AI Agent Model**: Google Gemini 2.0 Flash

### Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the code examples
3. Enable debug logging for detailed error information
4. Contact the development team

---

## Changelog

### Version 1.0
- Initial release
- PII detection with 17 entity types
- Content moderation with 9 categories
- AI-powered intent analysis
- Automated action recommendations
- Human review flagging system
- Fallback regex detection
- Comprehensive error handling

---

*Last Updated: January 2026*
