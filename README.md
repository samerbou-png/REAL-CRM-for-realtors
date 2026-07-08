# REAL CRM for Realtors

A **local-first** CRM inspired by [Real Geeks](https://www.realgeeks.com/) — lead feed, activity alerts, drip nurture, reactive follow-up — built for agents who want Real Geeks-style pipeline discipline **without** magical AI that pretends to be them.

Your leads, contacts, and deal history stay on your machine. AI runs through **Ollama** locally. Every outbound message is **drafted, not auto-sent**.

## The Idea

Real Geeks helps agents answer: *Who should I call right now?* and *What do I say?*

REAL CRM does the same, but with **realistic agent behavior**:

| Real Geeks-style feature | How we handle it |
|--------------------------|------------------|
| **Lead Feed** | Priority queue ranked by behavior signals — with explainable scores |
| **Activity alerts** | Lead saves listing, returns to site, goes quiet → task or draft |
| **Reactive responses** | Triggered follow-ups, not random check-ins |
| **Drip nurture** | Campaigns with human approval gates |
| **Geek AI** | Local Ollama drafts + summaries; you hit send |
| **Dialer / SMS** | Communication log first; provider integrations later |

See [docs/AGENT-BEHAVIOR.md](./docs/AGENT-BEHAVIOR.md) for the full behavioral spec.

## Philosophy

### Local-first

- Data lives in `data/` as CSV or SQLite — you own it, back it up, export it.
- Core CRM works offline. Cloud sync is optional.
- PII never leaves your machine for AI by default (Ollama at `127.0.0.1:11434`).

### Realistic agents, not magic

- AI is a **disciplined assistant**, not a replacement agent.
- Drafts only. Humans approve, edit, or reject before anything goes out.
- No invented listings, prices, or legal advice — escalate to the human instead.
- Full audit trail: trigger → draft → decision → outcome.

## Features (Roadmap)

### Phase 1 — Command center

- [x] Lead feed with explainable priority scoring
- [x] Pipeline stages: `new` → `contacted` → `qualified` → `showing` → `offer` → `closed` / `lost`
- [x] Activity log (calls, texts, emails, notes, site events)
- [x] Approval queue for AI-drafted messages

### Phase 2 — Reactive intelligence

- [ ] Behavior triggers (saved listing, repeat views, form submit, gone cold)
- [ ] Ollama summaries: "why this lead is hot" + suggested next action
- [ ] Drip campaigns with per-step approval

### Phase 3 — Integrations

- [ ] SMS/email provider hooks (send only after approval click)
- [ ] IDX / MLS read-only feeds (never hallucinate inventory)
- [ ] Mobile-friendly dashboard

## Prerequisites

- **Node.js** v22+
- **Ollama** — [https://ollama.com](https://ollama.com)
- **Cursor** (recommended) with local Ollama endpoint

### Recommended models

```bash
ollama pull qwen2.5-coder:7b    # Fast drafts and structured output
ollama pull llama3.1:8b         # Summaries and reasoning
ollama pull nomic-embed-text    # Semantic search (optional)
```

## Quick Start

```bash
git clone https://github.com/samerbou-png/REAL-CRM-for-realtors.git
cd REAL-CRM-for-realtors
npm install
cp .env.example .env
ollama serve
npm run seed    # optional demo leads
npm run dev     # http://localhost:3000
```

### CLI

```bash
npm run cli feed 10      # ranked lead feed in terminal
npm run cli approvals    # pending drafts
```

## Data Storage

Local files under `data/` (gitignored):

| File | Purpose |
|------|---------|
| `data/leads.csv` | Leads, pipeline stage, priority score |
| `data/contacts.csv` | Contact details and channels |
| `data/properties.csv` | Saved listings and showing history |
| `data/activities.csv` | Events, drafts, approvals, audit trail |
| `data/campaigns.csv` | Drip sequences and step status |

## Agent Loop

```
Activity event → Rank in Lead Feed → Ollama drafts next action
    → Human approves/edits/rejects → Send → Log outcome
```

Low-confidence or sensitive situations skip the draft and create a **"call personally"** task instead.

## Cursor + Ollama

1. **Settings → Models** → OpenAI-compatible provider
2. Base URL: `http://127.0.0.1:11434/v1`
3. API key: any non-empty string (e.g. `ollama`)
4. Select your local model in chat

Project rules: `.cursorrules` — local Ollama only, approval-first, realistic agent patterns.

## Project Structure

```
REAL-CRM-for-realtors/
├── .cursorrules
├── docs/
│   └── AGENT-BEHAVIOR.md
├── public/                 # Dashboard UI
├── src/
│   ├── services/           # leads, feed, activities, approvals, ollama
│   ├── server.js           # HTTP API
│   └── seed.js             # Demo data
├── data/                   # Local storage (gitignored)
├── tests/
├── package.json
└── README.md
```

## Development

```bash
npm run dev      # Dashboard + API on :3000
npm run seed     # Load demo leads
npm run cli feed # Terminal lead feed
npm test         # Run tests
```

## Security

- Never commit `.env` or `data/`
- No client PII in cloud AI chats
- Encrypt backups of `data/`

## License

MIT
