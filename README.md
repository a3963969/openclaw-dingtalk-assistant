# OpenClaw DingTalk Developer Assistant Plugin

OpenClaw plugin that integrates the DingTalk Open Platform AI Developer Assistant, enabling you to query DingTalk API documentation and development guidance directly from OpenClaw.

## API Endpoints (Captured)

| Step | Method | URL | Purpose |
|------|--------|-----|---------|
| 1 | POST | `open.dingtalk.com/api/open/coding/conversation` | Create conversation |
| 2 | GET | `power.dingtalk.com/api/open/sse/coding/completions?conversationId=&query=` | Stream answer (SSE) |
| 3 | GET | `open.dingtalk.com/api/open/coding/conversation/{id}` | Get history |
| 4 | GET | `open.dingtalk.com/api/open/coding/followup/recommend?scene=&askPageUrl=` | Recommended questions |

## Registered Tools

| Tool | Description |
|------|-------------|
| `dingtalk_ask` | Ask a new question, creates a fresh conversation |
| `dingtalk_followup` | Continue an existing conversation |
| `dingtalk_history` | Retrieve full conversation history |
| `dingtalk_recommend` | Get recommended questions for a doc page |

## Auto-Reply Command

```
/dingtalk 如何创建钉钉机器人？
```

## Install

```bash
# Link for development
openclaw plugins install -l ./openclaw-dingtalk-assistant

# Or install from path
openclaw plugins install ./openclaw-dingtalk-assistant
```

## Configuration

In `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "dingtalk-assistant": {
        "enabled": true,
        "config": {
          "baseUrl": "https://open.dingtalk.com",
          "sseBaseUrl": "https://power.dingtalk.com"
        }
      }
    }
  }
}
```

## Build

```bash
cd openclaw-dingtalk-assistant
npm install
npm run build
```
