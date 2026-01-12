# AI Moderation Documentation

Complete documentation for the Bloom AI moderation system.

## 🚀 Start Here

### **[Developer Guide](MODERATION_DOCS.md)** ← Start here!

Simple, practical guide with everything you need:
- 2-minute quick start
- Common use cases with code
- Integration patterns (FastAPI, WebSocket, Discord)
- Complete working examples

**This covers 90% of what you need.**

---

## 📖 Additional Documentation

Need more details? These comprehensive guides have you covered:

| Document | What's Inside | When To Use |
|----------|---------------|-------------|
| **[Developer Guide](MODERATION_DOCS.md)** | Quick start, examples, patterns | **Start here - most common use cases** |
| [API Reference](MODERATION_API_REFERENCE.md) | All methods, parameters, return types | Looking up specific methods |
| [Integration Examples](MODERATION_INTEGRATION_EXAMPLES.md) | FastAPI, Discord, queues, databases | Building specific integrations |
| [Complete Guide](AI_MODERATION_GUIDE.md) | Architecture, configuration, troubleshooting | Understanding system internals |
| [Quick Start](MODERATION_QUICK_START.md) | 5-minute setup and patterns | Alternative quick start |

---

## What It Does

The AI moderation system automatically detects:

✅ **Personal Information (PII)**
- Emails, phone numbers, credit cards
- Social security numbers, addresses
- Names, passwords, account numbers

✅ **Harmful Content**
- Sexual content
- Hate speech
- Violence
- Harassment

✅ **Smart Features**
- AI-powered intent analysis
- Automated action recommendations
- Human review flagging
- Fallback detection

---

## Quick Example

```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

message = ChatMessage(
    message_id="msg_123",
    content="User message here",
    user_id="user_456"
)

state = await moderate_message(message)

if state.recommended_action:
    print(f"⚠️ {state.recommended_action.action}: {state.recommended_action.reason}")
```

---

## Setup

```bash
# Add to .env
HF_TOKEN=your_huggingface_token
```

---

## Documentation Structure

```
docs/
├── README.md (this file)          # Navigation guide
├── MODERATION_DOCS.md            # Developer guide (START HERE)
├── MODERATION_API_REFERENCE.md   # Complete API reference
├── MODERATION_INTEGRATION_EXAMPLES.md  # Real-world integrations
├── AI_MODERATION_GUIDE.md        # Comprehensive guide
└── MODERATION_QUICK_START.md     # Alternative quick start
```

---

**👉 [Get Started with the Developer Guide](MODERATION_DOCS.md)**
