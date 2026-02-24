# Bear Knowledge

Daily transcripts and summaries from Bear Chat.

## Structure

```
scripts/
  collector.js    — Fetches messages from Bear Chat (3:00 AM)
  summarizer.js   — Generates structured summaries (3:15 AM)

chat-logs/
  YYYY-MM-DD/
    {channel}.md  — Raw transcripts per channel

chat-summaries/
  YYYY-MM-DD/
    {channel}.md  — Structured summaries
```

## Setup

### Collector (Henry's Mac)

1. Clone repo
2. Add to crontab:
```bash
0 3 * * * /usr/local/bin/node ~/bear-knowledge/scripts/collector.js >> ~/bear-knowledge/collector.log 2>&1
```

### Summarizer (Paddington VPS)

Already configured as OpenClaw cron `bear-chat-summarizer`.

## Channels Monitored

- general
- coding
- bear-agency
- bears-only
- beramonium
- consciousness

## Output Format

Each summary includes:
- Key decisions
- Action items
- Links shared
- Open questions

Channels with <3 messages are skipped.
