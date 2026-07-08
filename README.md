# REAL CRM for Realtors

A **local-first** customer relationship management system built for real estate professionals. Your leads, contacts, notes, and deal pipeline stay on your machine. AI assistance runs through **Ollama** on your own hardware — no client data is sent to cloud LLM providers by default.

## Philosophy: Local-First

This project follows local-first principles:

- **Your data, your device** — Contacts, leads, showings, and notes are stored in plain files (CSV) or SQLite on disk. You own the data and can back it up, diff it, or migrate it without vendor lock-in.
- **Offline-capable** — Core CRM workflows work without an internet connection. Sync to external services is optional and explicit.
- **Local AI by default** — Summaries, follow-up drafts, and lead scoring use Ollama models running at `http://127.0.0.1:11434`. Cloud APIs are never required for day-to-day use.
- **Privacy for PII** — Names, phone numbers, emails, and property addresses are sensitive. The architecture keeps them out of third-party AI pipelines unless you deliberately opt in.

## Features (planned)

- Lead and contact management with pipeline stages
- Property and showing tracking
- Activity log and follow-up reminders
- AI-assisted note summarization and outreach drafts (via Ollama)
- CSV import/export for spreadsheets and backups
- Optional upgrade path to SQLite for larger datasets

## Prerequisites

- **Node.js** v22 or later
- **Ollama** — [https://ollama.com](https://ollama.com)
- **Cursor** (recommended) — configured to use your local Ollama endpoint

### Recommended Ollama models

```bash
ollama pull qwen2.5-coder:7b    # Fast coding and text tasks
ollama pull llama3.1:8b         # General reasoning and drafts
ollama pull nomic-embed-text    # Embeddings for search (optional)
```

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/samerbou-png/REAL-CRM-for-realtors.git
cd REAL-CRM-for-realtors
npm install
```

### 2. Start Ollama

```bash
ollama serve
```

Verify a model is available:

```bash
ollama list
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5-coder:7b
DATA_DIR=./data
```

### 4. Run the app

```bash
npm run dev
```

## Data Storage

Local-first storage uses files under `data/` (gitignored):

| File | Purpose |
|------|---------|
| `data/leads.csv` | Lead records and pipeline status |
| `data/contacts.csv` | Contact details and channel mappings |
| `data/properties.csv` | Listings and showing history |
| `data/activities.csv` | Calls, emails, notes, and audit trail |

Export anytime:

```bash
npm run export
```

## Cursor + Ollama Setup

Cursor does not reach `localhost` directly from cloud agents. For **local development on your machine**:

1. Open **Settings → Models**
2. Add an OpenAI-compatible provider
3. Set **Base URL** to `http://127.0.0.1:11434/v1` (or your ngrok/Cloudflare tunnel URL if using remote Cursor)
4. Set **API Key** to any non-empty string (e.g. `ollama`)
5. Select your Ollama model in the chat dropdown

Project rules live in `.cursorrules` at the repo root. They enforce local-first and Ollama-only AI assistance for this codebase.

## Project Structure

```
REAL-CRM-for-realtors/
├── .cursorrules       # Local Ollama rules for Cursor
├── data/              # Local CSV/SQLite storage (gitignored)
├── src/               # Application source (coming soon)
├── package.json
└── README.md
```

## Development

```bash
npm run dev      # Start with file watching
npm run lint     # Lint source
npm run test     # Run tests
```

## Security

- Never commit `.env` or files under `data/`
- Do not paste client PII into cloud AI chats; use local Ollama only
- Back up `data/` regularly to encrypted storage

## License

MIT
