# Bloom AI Backend Documentation

Welcome to the Bloom AI backend documentation. This directory contains comprehensive guides for using the AI-powered moderation system.

## Documentation Index

### Getting Started

1. **[Quick Start Guide](MODERATION_QUICK_START.md)** - 5-minute setup and basic usage
   - Environment setup
   - Basic usage examples
   - Common patterns
   - Quick testing

### Comprehensive Guides

2. **[AI Moderation Guide](AI_MODERATION_GUIDE.md)** - Complete documentation
   - System architecture
   - Feature overview
   - Configuration options
   - Best practices
   - Troubleshooting

3. **[API Reference](MODERATION_API_REFERENCE.md)** - Complete method reference
   - All functions and methods
   - Data models and enums
   - Parameters and return types
   - Code examples for each method

4. **[Integration Examples](MODERATION_INTEGRATION_EXAMPLES.md)** - Real-world implementations
   - FastAPI REST API integration
   - WebSocket real-time chat
   - Discord bot integration
   - Message queue processing
   - Database integration
   - Admin dashboard

## Quick Navigation

### By Task

**I want to...**

- **Get started quickly** → [Quick Start Guide](MODERATION_QUICK_START.md)
- **Understand the system** → [AI Moderation Guide](AI_MODERATION_GUIDE.md#architecture)
- **See API details** → [API Reference](MODERATION_API_REFERENCE.md)
- **Integrate into my app** → [Integration Examples](MODERATION_INTEGRATION_EXAMPLES.md)
- **Configure the system** → [Configuration Guide](AI_MODERATION_GUIDE.md#configuration)
- **Troubleshoot issues** → [Troubleshooting](AI_MODERATION_GUIDE.md#troubleshooting)

### By Feature

**I need to...**

- **Detect PII** → [PII Detection API](MODERATION_API_REFERENCE.md#detect_pii)
- **Moderate content** → [Content Moderation API](MODERATION_API_REFERENCE.md#moderate_content)
- **Analyze intent** → [PIIAgent Reference](MODERATION_API_REFERENCE.md#piiagent)
- **Determine actions** → [ModAgent Reference](MODERATION_API_REFERENCE.md#modagent)
- **Implement webhooks** → [FastAPI Integration](MODERATION_INTEGRATION_EXAMPLES.md#fastapi-rest-api-integration)
- **Build a bot** → [Discord Bot Example](MODERATION_INTEGRATION_EXAMPLES.md#discord-bot-integration)

### By Role

**For Developers:**
- Start: [Quick Start Guide](MODERATION_QUICK_START.md)
- Reference: [API Reference](MODERATION_API_REFERENCE.md)
- Examples: [Integration Examples](MODERATION_INTEGRATION_EXAMPLES.md)

**For System Architects:**
- Overview: [Architecture](AI_MODERATION_GUIDE.md#architecture)
- Configuration: [Configuration Guide](AI_MODERATION_GUIDE.md#configuration)
- Best Practices: [Best Practices](AI_MODERATION_GUIDE.md#best-practices)

**For Operations:**
- Setup: [Getting Started](AI_MODERATION_GUIDE.md#getting-started)
- Troubleshooting: [Troubleshooting Guide](AI_MODERATION_GUIDE.md#troubleshooting)
- Monitoring: [Admin Dashboard](MODERATION_INTEGRATION_EXAMPLES.md#admin-dashboard)

## Feature Overview

### AI-Powered Detection

The moderation system uses multiple AI models:

- **PII Detection**: `iiiorg/piiranha-v1-detect-personal-information`
- **Content Moderation**: `KoalaAI/Text-Moderation`
- **Intent Analysis**: Google Gemini 2.0 Flash
- **Action Determination**: Google Gemini 2.0 Flash

### Capabilities

- Detects 17 types of personally identifiable information
- Classifies content into 9 categories
- AI-powered intent analysis
- Automated action recommendations (WARNING, KICK, BAN)
- Human review flagging
- Fallback regex detection
- Async processing for high performance

## Quick Example

```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

# Create message
message = ChatMessage(
    message_id="msg_123",
    content="Sample message",
    user_id="user_456"
)

# Moderate
state = await moderate_message(message)

# Check results
if state.recommended_action:
    print(f"Action: {state.recommended_action.action}")
    print(f"Reason: {state.recommended_action.reason}")

if state.flag:
    print("Flagged for human review")
```

## System Requirements

- Python 3.8+
- HuggingFace API token
- Required packages:
  - `pydantic-ai`
  - `pydantic-graph`
  - `requests`
  - `asyncio`

## Environment Setup

```bash
# Set HuggingFace token
export HF_TOKEN="hf_your_token_here"

# Or add to .env file
echo "HF_TOKEN=hf_your_token_here" >> .env
```

## File Structure

```
backend/
├── agents/
│   └── moderation/
│       ├── __init__.py       # Package exports
│       ├── state.py          # Data models and enums
│       ├── nodes.py          # Detection logic and AI agents
│       └── graph.py          # Main entry point
└── docs/
    ├── README.md                              # This file
    ├── MODERATION_QUICK_START.md             # Quick start guide
    ├── AI_MODERATION_GUIDE.md                # Comprehensive guide
    ├── MODERATION_API_REFERENCE.md           # API reference
    └── MODERATION_INTEGRATION_EXAMPLES.md    # Integration examples
```

## Support

### Documentation Issues
If you find errors or have suggestions for the documentation:
1. Check the troubleshooting section
2. Review the relevant guide
3. Contact the development team

### Code Issues
For issues with the moderation system itself:
1. Enable debug logging
2. Check the error logs
3. Review the [Troubleshooting Guide](AI_MODERATION_GUIDE.md#troubleshooting)

## Additional Resources

### External Links
- [HuggingFace PII Model](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information)
- [HuggingFace Content Model](https://huggingface.co/KoalaAI/Text-Moderation)
- [Google Gemini Documentation](https://ai.google.dev/docs)

### Code References
- Main Implementation: [backend/agents/moderation/nodes.py](../agents/moderation/nodes.py)
- State Definitions: [backend/agents/moderation/state.py](../agents/moderation/state.py)
- Entry Point: [backend/agents/moderation/graph.py](../agents/moderation/graph.py)

## Version Information

**Current Version:** 1.0

**Last Updated:** January 2026

**Changelog:**
- v1.0 - Initial release
  - PII detection with 17 entity types
  - Content moderation with 9 categories
  - AI-powered analysis
  - Action recommendations
  - Human review flagging

---

## Quick Links

| Document | Description | Best For |
|----------|-------------|----------|
| [Quick Start](MODERATION_QUICK_START.md) | 5-minute setup | First-time users |
| [Full Guide](AI_MODERATION_GUIDE.md) | Complete documentation | Understanding the system |
| [API Reference](MODERATION_API_REFERENCE.md) | Method reference | Development |
| [Examples](MODERATION_INTEGRATION_EXAMPLES.md) | Real-world code | Implementation |

---

*Choose a document from the links above to get started!*
