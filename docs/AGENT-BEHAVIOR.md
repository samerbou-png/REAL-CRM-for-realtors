# Agent Behavior Spec

REAL CRM is inspired by platforms like [Real Geeks](https://www.realgeeks.com/) — lead feed, activity alerts, drip nurture, reactive follow-up — but replaces magical "set and forget" AI with **realistic agent behavior** that a working realtor can actually trust.

## Design Principle

> The AI is a disciplined assistant, not a replacement agent.

It surfaces who needs attention, drafts what to say, and logs what happened. The human realtor still owns the relationship, the send button, and the close.

## Real Geeks Parity (What We're Building Toward)

| Real Geeks capability | Our local-first equivalent |
|-----------------------|----------------------------|
| Lead Feed / Smart Filters | Priority queue ranked by behavior signals + staleness |
| Website activity alerts | Activity events → reactive task suggestions |
| Reactive responses | Triggered drafts when lead saves listing, returns, etc. |
| Drip workflows | Scheduled nurture sequences with human approval gates |
| Dialer / SMS / email | Communication log + click-to-call; drafts, not auto-blast |
| Property & market alerts | Saved-search match notifications (local data first) |
| Geek AI insights | Ollama summaries: motivation hints, next-best-action |
| Lead ponds / routing | Team assignment rules (single-agent MVP first) |
| CRM mobile | Responsive UI later; local data syncs via files |

We do **not** need to clone IDX websites or managed PPC on day one. Core value is **know who to call next** and **follow up without dropping leads**.

## Realistic Agent Behavior Rules

### 1. Approval-first outbound

- AI may **draft** texts, emails, and call scripts.
- AI may **never** send, schedule, or post without explicit human approval.
- Every outbound message has states: `draft` → `approved` → `sent` | `rejected`.

### 2. Signal-driven, not spam-driven

Reactive actions require a **concrete trigger**:

- Saved a property
- Viewed same listing 3+ times
- Returned after 7+ days idle
- Submitted contact form
- Replied to a prior message

No "check in for no reason" drips unless the human enabled a named campaign.

### 3. Confidence and escalation

Before suggesting an action, the agent evaluates:

| Signal | Action |
|--------|--------|
| High confidence + routine follow-up | Draft message, queue for review |
| Medium confidence | Draft + flag "review recommended" |
| Low confidence / sensitive topic | No draft; create task: "Call lead personally" |
| Legal, financing, or offer terms | **Never** auto-draft; escalate to human only |

### 4. Honest limitations

The agent must **not**:

- Invent MLS listings, prices, or availability
- Claim to have toured a property
- Promise rates, timelines, or outcomes
- Pretend to be the human realtor in autonomous mode

When data is missing, say so and ask the human to fill the gap.

### 5. Business-hours and tone realism

- Default quiet hours: no suggested sends 9pm–8am local (configurable).
- Tone: professional, warm, concise — like a busy agent, not a chatbot essay.
- One clear ask per message (schedule call, confirm showing, share listing).

### 6. Audit everything

Log to `activities.csv`:

- Trigger event
- Model used (Ollama model name)
- Draft generated
- Human decision (approved / edited / rejected)
- Timestamp

### 7. Human correction loop

When a human edits a draft before sending:

- Store `original_draft` and `final_sent` for future tone calibration.
- Do not retrain models automatically in MVP; use edits as few-shot context locally.

## Agent Loop (MVP)

```
Lead activity event
    ↓
Rank in Lead Feed (score + recency + intent)
    ↓
Ollama: summarize context + propose next action
    ↓
If confidence < threshold → task for human only
    ↓
Else → create draft in approval queue
    ↓
Human reviews in dashboard → approve / edit / reject
    ↓
On approve → human sends (or system sends only after explicit click)
    ↓
Log outcome → update lead stage
```

## Lead Feed Scoring (Simplified)

```
priority_score =
  intent_signals   (0–40)  # saves, returns, form submit
+ recency          (0–30)  # hours since last activity
+ stage_urgency    (0–20)  # showing scheduled, offer pending
- staleness_penalty(0–20)  # no touch in N days
```

Surface top N leads on login. No black-box "AI said so" — show **why** each lead is hot.

## Ollama Prompt Contract

System prompts for the CRM agent must include:

1. Role: assistant to a licensed realtor, not the realtor.
2. Available facts: only fields present in the lead record and activity log.
3. Output schema: `{ summary, suggested_action, draft_message?, confidence, escalate }`.
4. Refusal: if asked to fabricate property or legal advice, return `escalate: true`.

## Anti-Patterns (Forbidden)

- Auto-responder that impersonates the agent 24/7 without disclosure
- Bulk texting leads who haven't opted in
- Sending the same template to every lead regardless of behavior
- Cloud LLM calls with PII for "convenience"
- Hiding that a message was AI-assisted when regulations require disclosure

## MVP Scope

**In scope**

- Lead feed with explainable ranking
- Activity ingestion (manual + CSV import)
- Draft queue with approve/reject
- Ollama-powered summaries and draft generation
- Reactive triggers for 3–5 core events

**Out of scope (later)**

- IDX website builder
- Managed ad campaigns
- Full dialer/SMS provider integration
- Multi-tenant brokerage admin
