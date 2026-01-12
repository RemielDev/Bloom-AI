# Bloom AI - Sentiment Analysis & Moderation Platform

A real-time sentiment analysis and content moderation platform with AI-powered features.

## What it does

- **AI Moderation**: Automatically detects inappropriate content, PII, hate speech, violence
- **Sentiment Analysis**: Real-time chat message sentiment tracking
- **Real-time Analytics**: Dashboard with moderation statistics and user insights
- **Content Filtering**: AI-powered filtering with human review flagging
- **User Management**: Automated actions (warnings, kicks, bans) based on violations

## 📚 Documentation

**AI Moderation System** - Complete developer guide:
- **[Quick Start Guide](backend/docs/MODERATION_DOCS.md)** - Get up and running in 2 minutes
- **[Full Documentation](backend/docs/)** - Comprehensive guides, API reference, and integration examples

The AI moderation system detects:
- 17 types of personal information (emails, phone numbers, SSN, credit cards, etc.)
- Harmful content (sexual, hate speech, violence, harassment)
- User intent to share sensitive information
- Provides automated action recommendations with human review flagging

## Tech Stack

### Backend
- FastAPI (Python)
- Google Gemini AI
- Supabase database
- Sentiment analysis services

### Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Radix UI components

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.app:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the backend directory:
```bash
# AI Services
GOOGLE_API_KEY=your_google_api_key
BLOOM_API_KEY=your_bloom_api_key
HF_TOKEN=your_huggingface_token  # Required for AI moderation

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Features

### AI Moderation
- Automatic PII detection (emails, phones, SSN, credit cards, addresses, etc.)
- Content classification (sexual, hate speech, violence, harassment)
- AI-powered intent analysis
- Automated action recommendations (WARNING, KICK, BAN)
- Human review flagging for ambiguous cases
- Fallback regex detection

### Analytics & Management
- Real-time chat sentiment analysis
- User analytics dashboard
- Leaderboard system
- Moderation queue management
- Violation tracking and reporting

## Using the AI Moderation System

Simple example:

```python
from backend.agents.moderation import moderate_message
from models.chat import ChatMessage

# Moderate any message
message = ChatMessage(
    message_id="msg_123",
    content="User message here",
    user_id="user_456"
)

state = await moderate_message(message)

# Check results
if state.recommended_action:
    print(f"⚠️ {state.recommended_action.action}: {state.recommended_action.reason}")

if state.flag:
    print("🚩 Flagged for manual review")
```

**[→ See full developer guide](backend/docs/MODERATION_DOCS.md)** for integration examples with FastAPI, WebSockets, Discord bots, and more.
