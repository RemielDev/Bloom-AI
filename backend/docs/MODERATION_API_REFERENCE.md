# AI Moderation API Reference

Complete API reference for all methods, classes, and enums in the moderation system.

## Table of Contents

1. [Core Functions](#core-functions)
2. [Detection Functions](#detection-functions)
3. [AI Agents](#ai-agents)
4. [Data Models](#data-models)
5. [Enumerations](#enumerations)
6. [Node Classes](#node-classes)
7. [Constants](#constants)

---

## Core Functions

### `moderate_message()`

Main entry point for message moderation. Performs complete analysis including PII detection, intent analysis, content moderation, and action determination.

**Signature:**
```python
async def moderate_message(message: ChatMessage) -> ModerationState
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `message` | `ChatMessage` | Message object containing content to moderate |

**Returns:**
| Type | Description |
|------|-------------|
| `ModerationState` | Complete moderation analysis with results and recommendations |

**Example:**
```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

message = ChatMessage(
    message_id="msg_123",
    content="Sample message content",
    user_id="user_456"
)

state = await moderate_message(message)

# Access results
if state.recommended_action:
    print(f"Action: {state.recommended_action.action}")
    print(f"Reason: {state.recommended_action.reason}")
```

**Error Handling:**
```python
try:
    state = await moderate_message(message)
except Exception as e:
    # Returns default state with flag=True on error
    logger.error(f"Moderation failed: {e}")
```

**Location:** [backend/agents/moderation/graph.py:8-32](../agents/moderation/graph.py#L8-L32)

---

## Detection Functions

### `detect_pii()`

Detects personally identifiable information using AI-powered detection with HuggingFace models.

**Signature:**
```python
async def detect_pii(text: str) -> list[dict]
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `text` | `str` | Text content to analyze for PII |

**Returns:**
| Type | Description |
|------|-------------|
| `list[dict]` | List of detected PII entities with entity_group, word, score |

**Response Format:**
```python
[
    {
        "entity_group": "EMAIL",
        "word": "user@example.com",
        "score": 0.99,
        "start": 12,
        "end": 29
    },
    {
        "entity_group": "TELEPHONENUM",
        "word": "555-1234",
        "score": 0.95,
        "start": 45,
        "end": 53
    }
]
```

**Example:**
```python
from backend.agents.moderation.nodes import detect_pii

text = "Contact me at john@example.com or call 555-123-4567"
pii_entities = await detect_pii(text)

for entity in pii_entities:
    pii_type = entity.get("entity_group")
    detected_text = entity.get("word")
    confidence = entity.get("score")
    print(f"Found {pii_type}: {detected_text} (confidence: {confidence:.2%})")
```

**Error Handling:**
- Returns empty list `[]` on API failure
- Implements 30-second timeout
- Logs errors to console

**API Details:**
- **Model:** `iiiorg/piiranha-v1-detect-personal-information`
- **Endpoint:** HuggingFace Inference API
- **Timeout:** 30 seconds

**Location:** [backend/agents/moderation/nodes.py:51-69](../agents/moderation/nodes.py#L51-L69)

---

### `moderate_content()`

Classifies content into moderation categories using AI text classification.

**Signature:**
```python
async def moderate_content(text: str) -> list[dict]
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `text` | `str` | Text content to classify |

**Returns:**
| Type | Description |
|------|-------------|
| `list[dict]` | List of categories with labels and confidence scores |

**Response Format:**
```python
[
    {"label": "OK", "score": 0.92},
    {"label": "S", "score": 0.05},
    {"label": "H", "score": 0.02},
    {"label": "V", "score": 0.01}
]
```

**Example:**
```python
from backend.agents.moderation.nodes import moderate_content

text = "This is a test message"
categories = await moderate_content(text)

# Get main category
main_category = max(categories, key=lambda x: x.get("score", 0))
print(f"Main category: {main_category['label']} ({main_category['score']:.2%})")

# Check for harmful content
harmful = [cat for cat in categories if cat['label'] != 'OK' and cat['score'] > 0.5]
if harmful:
    print(f"Harmful content detected: {harmful}")
```

**Category Labels:**
- `OK` - Safe content
- `S` - Sexual content
- `H` - Hate speech
- `V` - Violence
- `HR` - Harassment
- `SH` - Sexual + Hate speech
- `S3`, `H2`, `V2` - Severe variants

**Error Handling:**
- Returns `[{"label": "OK", "score": 1.0}]` on failure
- Handles malformed responses
- Implements 30-second timeout

**API Details:**
- **Model:** `KoalaAI/Text-Moderation`
- **Endpoint:** HuggingFace Inference API
- **Timeout:** 30 seconds

**Location:** [backend/agents/moderation/nodes.py:72-100](../agents/moderation/nodes.py#L72-L100)

---

## AI Agents

### `PIIAgent`

AI agent that analyzes user intent to share personal information.

**Configuration:**
```python
PIIAgent = Agent(
    GEMINI_MODEL,
    system_prompt=PII_INTENT_PROMPT,
    output_type=bool
)
```

**Model:** `google-gla:gemini-2.0-flash`

**System Prompt:**
> "Analyze if the message contains intent to share personal information. Return only true or false."

**Usage:**
```python
from backend.agents.moderation.nodes import PIIAgent

result = await PIIAgent.run("I want to share my phone number with you")
has_intent = result.output  # True

result = await PIIAgent.run("What's your favorite color?")
has_intent = result.output  # False
```

**Return Type:** `bool`
- `True` - User intends to share PII
- `False` - No intent detected

**Location:** [backend/agents/moderation/nodes.py:104](../agents/moderation/nodes.py#L104)

---

### `ModAgent`

AI agent that determines appropriate moderation action for harmful content.

**Configuration:**
```python
ModAgent = Agent(
    GEMINI_MODEL,
    system_prompt=MODERATION_ACTION_PROMPT,
    output_type=ModAction
)
```

**Model:** `google-gla:gemini-2.0-flash`

**System Prompt:**
> "Determine the appropriate moderation action for harmful content. Available actions: WARNING (for mild violations), KICK (for serious violations), BAN (for severe violations requiring human review). Return the action and reason."

**Usage:**
```python
from backend.agents.moderation.nodes import ModAgent

prompt = "Content type: H, Message: This is hate speech"
result = await ModAgent.run(prompt)
action = result.output

print(f"Action: {action.action}")      # ActionType.BAN
print(f"Reason: {action.reason}")      # "Severe hate speech detected..."
```

**Return Type:** `ModAction`
```python
ModAction(
    action=ActionType,  # WARNING, KICK, or BAN
    reason=str          # Explanation for the action
)
```

**Action Guidelines:**
- `WARNING` - Mild violations, first-time offenses
- `KICK` - Serious violations, repeated offenses
- `BAN` - Severe violations requiring human review

**Location:** [backend/agents/moderation/nodes.py:106-108](../agents/moderation/nodes.py#L106-L108)

---

## Data Models

### `ModerationState`

Main state container for moderation results.

**Definition:**
```python
class ModerationState(BaseModel):
    message: ChatMessage
    pii_result: Optional[PIIResult] = None
    content_result: Optional[ContentResult] = None
    recommended_action: Optional[ModAction] = None
    flag: bool = False
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `message` | `ChatMessage` | required | Original message being moderated |
| `pii_result` | `PIIResult \| None` | `None` | PII detection results |
| `content_result` | `ContentResult \| None` | `None` | Content classification results |
| `recommended_action` | `ModAction \| None` | `None` | Suggested moderation action |
| `flag` | `bool` | `False` | Whether to flag for human review |

**Example:**
```python
state = ModerationState(message=message)

# After moderation
if state.pii_result:
    print(f"PII detected: {state.pii_result.pii_type}")

if state.content_result:
    print(f"Category: {state.content_result.main_category}")

if state.recommended_action:
    print(f"Action: {state.recommended_action.action}")

if state.flag:
    print("Flagged for human review")
```

**Location:** [backend/agents/moderation/state.py:65-70](../agents/moderation/state.py#L65-L70)

---

### `PIIResult`

Results from PII detection analysis.

**Definition:**
```python
class PIIResult(BaseModel):
    pii_presence: bool
    pii_type: Optional[PIIType] = None
    pii_intent: Optional[bool] = None
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pii_presence` | `bool` | required | Whether PII was detected |
| `pii_type` | `PIIType \| None` | `None` | Type of PII detected (if any) |
| `pii_intent` | `bool \| None` | `None` | Whether user intends to share PII |

**Example:**
```python
if state.pii_result:
    if state.pii_result.pii_presence:
        print(f"PII Type: {state.pii_result.pii_type.value}")

        if state.pii_result.pii_intent:
            print("User intends to share this information")
        else:
            print("PII mentioned without sharing intent")
```

**Location:** [backend/agents/moderation/state.py:49-52](../agents/moderation/state.py#L49-L52)

---

### `ContentResult`

Results from content classification analysis.

**Definition:**
```python
class ContentResult(BaseModel):
    main_category: ContentType
    categories: Dict[str, float]
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `main_category` | `ContentType` | Primary content classification |
| `categories` | `Dict[str, float]` | All categories with confidence scores (0.0-1.0) |

**Example:**
```python
if state.content_result:
    print(f"Main category: {state.content_result.main_category.value}")

    # Show all categories above threshold
    for category, score in state.content_result.categories.items():
        if score > 0.1:
            print(f"{category}: {score:.2%}")

    # Check for specific harmful content
    if state.content_result.main_category in [ContentType.S, ContentType.H, ContentType.V]:
        print("Harmful content detected")
```

**Location:** [backend/agents/moderation/state.py:55-57](../agents/moderation/state.py#L55-L57)

---

### `ModAction`

Recommended moderation action with reasoning.

**Definition:**
```python
class ModAction(BaseModel):
    action: ActionType
    reason: str
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `ActionType` | Action to take (WARNING, KICK, BAN) |
| `reason` | `str` | Human-readable explanation for the action |

**Example:**
```python
if state.recommended_action:
    action = state.recommended_action

    if action.action == ActionType.WARNING:
        await send_warning(user_id, action.reason)

    elif action.action == ActionType.KICK:
        await kick_user(user_id, action.reason)

    elif action.action == ActionType.BAN:
        await ban_user(user_id, action.reason)
        await notify_admins(user_id, action.reason)
```

**Location:** [backend/agents/moderation/state.py:60-62](../agents/moderation/state.py#L60-L62)

---

## Enumerations

### `PIIType`

Types of personally identifiable information.

**Definition:**
```python
class PIIType(str, Enum):
    ACCOUNTNUM = "ACCOUNTNUM"
    BUILDINGNUM = "BUILDINGNUM"
    CITY = "CITY"
    CREDITCARDNUMBER = "CREDITCARDNUMBER"
    DATEOFBIRTH = "DATEOFBIRTH"
    DRIVERLICENSENUM = "DRIVERLICENSENUM"
    EMAIL = "EMAIL"
    GIVENNAME = "GIVENNAME"
    IDCARDNUM = "IDCARDNUM"
    PASSWORD = "PASSWORD"
    SOCIALNUM = "SOCIALNUM"
    STREET = "STREET"
    SURNAME = "SURNAME"
    TAXNUM = "TAXNUM"
    TELEPHONENUM = "TELEPHONENUM"
    USERNAME = "USERNAME"
    ZIPCODE = "ZIPCODE"
```

**Values:**

| Value | Description | Example |
|-------|-------------|---------|
| `ACCOUNTNUM` | Account numbers | ACC-123456 |
| `BUILDINGNUM` | Building/apartment numbers | Apt 4B |
| `CITY` | City names | Springfield |
| `CREDITCARDNUMBER` | Credit card numbers | 4111-1111-1111-1111 |
| `DATEOFBIRTH` | Birth dates | 01/15/1990 |
| `DRIVERLICENSENUM` | Driver's license numbers | D1234567 |
| `EMAIL` | Email addresses | user@example.com |
| `GIVENNAME` | First names | John |
| `IDCARDNUM` | ID card numbers | ID-987654 |
| `PASSWORD` | Passwords | myP@ssw0rd |
| `SOCIALNUM` | Social security numbers | 123-45-6789 |
| `STREET` | Street addresses | 123 Main St |
| `SURNAME` | Last names | Smith |
| `TAXNUM` | Tax ID numbers | TAX-123456 |
| `TELEPHONENUM` | Phone numbers | (555) 123-4567 |
| `USERNAME` | Usernames | john_doe123 |
| `ZIPCODE` | ZIP/postal codes | 12345 |

**Usage:**
```python
from backend.agents.moderation import PIIType

if state.pii_result and state.pii_result.pii_type:
    if state.pii_result.pii_type == PIIType.EMAIL:
        print("Email address detected")
    elif state.pii_result.pii_type == PIIType.TELEPHONENUM:
        print("Phone number detected")
```

**Location:** [backend/agents/moderation/state.py:10-27](../agents/moderation/state.py#L10-L27)

---

### `ContentType`

Content classification categories.

**Definition:**
```python
class ContentType(str, Enum):
    OK = "OK"
    S = "S"
    H = "H"
    V = "V"
    HR = "HR"
    SH = "SH"
    S3 = "S3"
    H2 = "H2"
    V2 = "V2"
```

**Values:**

| Value | Description | Severity |
|-------|-------------|----------|
| `OK` | Safe content | None |
| `S` | Sexual content | Moderate |
| `H` | Hate speech | Moderate |
| `V` | Violence | Moderate |
| `HR` | Harassment | Moderate |
| `SH` | Sexual + Hate speech | High |
| `S3` | Severe sexual content | Severe |
| `H2` | Severe hate speech | Severe |
| `V2` | Severe violence | Severe |

**Usage:**
```python
from backend.agents.moderation import ContentType

if state.content_result:
    category = state.content_result.main_category

    if category == ContentType.OK:
        print("Content is safe")
    elif category in [ContentType.S3, ContentType.H2, ContentType.V2]:
        print("Severe violation detected")
    elif category != ContentType.OK:
        print("Moderate violation detected")
```

**Location:** [backend/agents/moderation/state.py:30-39](../agents/moderation/state.py#L30-L39)

---

### `ActionType`

Moderation actions that can be taken.

**Definition:**
```python
class ActionType(str, Enum):
    WARNING = "WARNING"
    KICK = "KICK"
    BAN = "BAN"
```

**Values:**

| Value | Description | Use Case |
|-------|-------------|----------|
| `WARNING` | Issue warning to user | Mild violations, PII detected, first offense |
| `KICK` | Remove from conversation | Serious violations, repeated offenses |
| `BAN` | Ban user account | Severe violations, requires human review |

**Usage:**
```python
from backend.agents.moderation import ActionType

if state.recommended_action:
    if state.recommended_action.action == ActionType.WARNING:
        await warn_user(user_id)
    elif state.recommended_action.action == ActionType.KICK:
        await kick_user(user_id)
    elif state.recommended_action.action == ActionType.BAN:
        await ban_user(user_id)
        await notify_admins(user_id)
```

**Location:** [backend/agents/moderation/state.py:42-45](../agents/moderation/state.py#L42-L45)

---

## Node Classes

### `StartModeration`

Main orchestrator node that coordinates all moderation checks.

**Methods:**

#### `run()`

**Signature:**
```python
async def run(self, state: ModerationState) -> ModerationState
```

**Process:**
1. Check for PII
2. Check PII intent (if PII detected)
3. Check content categories
4. Determine recommended action
5. Flag for human review if needed

**Example:**
```python
from backend.agents.moderation.nodes import StartModeration

state = ModerationState(message=message)
moderator = StartModeration()
result = await moderator.run(state)
```

**Location:** [backend/agents/moderation/nodes.py:129-165](../agents/moderation/nodes.py#L129-L165)

---

#### `_check_pii()`

Internal method for PII detection with fallback.

**Signature:**
```python
async def _check_pii(self, content: str) -> PIIResult
```

**Process:**
1. Try AI-based detection
2. Fall back to regex on failure
3. Return PIIResult

**Location:** [backend/agents/moderation/nodes.py:167-214](../agents/moderation/nodes.py#L167-L214)

---

#### `_check_pii_intent()`

Internal method for intent analysis.

**Signature:**
```python
async def _check_pii_intent(self, content: str) -> bool
```

**Returns:** `True` if intent detected, `False` otherwise

**Location:** [backend/agents/moderation/nodes.py:216-224](../agents/moderation/nodes.py#L216-L224)

---

#### `_check_content()`

Internal method for content classification.

**Signature:**
```python
async def _check_content(self, content: str) -> ContentResult
```

**Returns:** ContentResult with categories and scores

**Location:** [backend/agents/moderation/nodes.py:226-258](../agents/moderation/nodes.py#L226-L258)

---

#### `_determine_action()`

Internal method for action determination.

**Signature:**
```python
async def _determine_action(self, state: ModerationState) -> ModAction | None
```

**Returns:** ModAction if action needed, None otherwise

**Location:** [backend/agents/moderation/nodes.py:260-286](../agents/moderation/nodes.py#L260-L286)

---

#### `_should_flag_for_review()`

Internal method to determine if human review is needed.

**Signature:**
```python
async def _should_flag_for_review(self, state: ModerationState) -> bool
```

**Flags when:**
- BAN or KICK actions recommended
- PII detected
- Multiple content categories above threshold

**Location:** [backend/agents/moderation/nodes.py:288-320](../agents/moderation/nodes.py#L288-L320)

---

## Constants

### API Configuration

```python
# API Endpoints
PII_DETECTION_API_URL = "https://router.huggingface.co/hf-inference/models/iiiorg/piiranha-v1-detect-personal-information"
CONTENT_MODERATION_API_URL = "https://router.huggingface.co/hf-inference/models/KoalaAI/Text-Moderation"

# AI Models
GEMINI_MODEL = "google-gla:gemini-2.0-flash"

# Timeouts
API_TIMEOUT = 30  # seconds

# Defaults
DEFAULT_PII_RESPONSE = []
DEFAULT_CONTENT_RESPONSE = [{"label": "OK", "score": 1.0}]
```

**Location:** [backend/agents/moderation/nodes.py:26-41](../agents/moderation/nodes.py#L26-L41)

---

### Agent Prompts

```python
# PII Intent Detection
PII_INTENT_PROMPT = "Analyze if the message contains intent to share personal information. Return only true or false."

# Moderation Action Determination
MODERATION_ACTION_PROMPT = (
    "Determine the appropriate moderation action for harmful content. "
    "Available actions: WARNING (for mild violations), "
    "KICK (for serious violations), "
    "BAN (for severe violations requiring human review). "
    "Return the action and reason."
)
```

**Location:** [backend/agents/moderation/nodes.py:43-47](../agents/moderation/nodes.py#L43-L47)

---

## Quick Reference

### Import Statements

```python
# Main function
from backend.agents.moderation import moderate_message

# Detection functions
from backend.agents.moderation.nodes import detect_pii, moderate_content

# AI Agents
from backend.agents.moderation.nodes import PIIAgent, ModAgent

# Data models
from backend.agents.moderation import (
    ModerationState,
    PIIResult,
    ContentResult,
    ModAction
)

# Enums
from backend.agents.moderation import (
    PIIType,
    ContentType,
    ActionType
)

# Node class
from backend.agents.moderation.nodes import StartModeration
```

### Common Patterns

```python
# Basic moderation
state = await moderate_message(message)

# Check for PII only
pii_data = await detect_pii(text)

# Check content only
categories = await moderate_content(text)

# Use AI agent
intent = (await PIIAgent.run(text)).output
action = (await ModAgent.run(prompt)).output
```

---

*For usage examples, see [MODERATION_QUICK_START.md](MODERATION_QUICK_START.md)*

*For integration patterns, see [MODERATION_INTEGRATION_EXAMPLES.md](MODERATION_INTEGRATION_EXAMPLES.md)*

*For comprehensive guide, see [AI_MODERATION_GUIDE.md](AI_MODERATION_GUIDE.md)*
