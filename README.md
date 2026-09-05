# Gemini Vault

> **Think freely. Remember what matters.**

Gemini Vault is a production-grade private AI reflection workspace built around a fundamental insight: an AI journal should remember what you deliberately choose to keep, understand how your thoughts and intentions evolve over time, and help you translate self-reflection into real-world action without ever sacrificing privacy or agency.

Built for the **Google Cloud Run AI Challenge**.

- **Production URL**: [https://gemini-vault-935700896025.asia-south1.run.app](https://gemini-vault-935700896025.asia-south1.run.app)
- **Google Cloud Run Challenge Label**: `dev-tutorial=cloud-run-ai-challenge`
- **Project ID**: `gemini-vault-507219` | **Region**: `asia-south1`

---

## The Complete Product Loop

```text
Reflect → Understand → Remember → Notice Change → Plan → Act → Reflect Again
```

1. **Reflect**: Capture complex thoughts via 7 structured reflection modes or real-time voice conversations.
2. **Understand**: Bounded Gemini models synthesize nuance, context, and emotional tone without diagnosing.
3. **Remember**: User explicitly approves memory extractions with immutable provenance links to source reflections.
4. **Notice Change**: Longitudinal intelligence tracks thematic evolution, goal shifts, and contradictions across weeks.
5. **Plan**: Longitudinal commitments and intentions are synthesized into weekly agendas with seasonal milestone awareness.
6. **Act**: The AI proposes context-rich next steps; the user approves them and executes through confirm-first Google Calendar, Maps, and Gmail handoffs.
7. **Reflect Again**: Real-world experiences loop right back into the next session.

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER (React + TypeScript)                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ Reflect Studio  │  │   Voice Studio   │  │ Commitments & Calendar View  │ │
│  │ 7 Focus Modes   │  │  16-bit 24kHz    │  │  Weekly Agenda & Milestone   │ │
│  │ Focus Mode UI   │  │  Live Audio Orb  │  │  Opportunity Catalog         │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────────────┬───────────────┘ │
│           │                    │                           │                 │
│  ┌────────┴────────┐  ┌────────┴─────────┐  ┌──────────────┴───────────────┐ │
│  │  Memory Vault   │  │ Vault Signals &  │  │       Document Studio        │ │
│  │  Provenance &   │  │ Longitudinal     │  │   Multi-Page PDF & Markdown  │ │
│  │  Open Loops     │  │ Weekly Review    │  │   Chunk Grounding & Search   │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────────────┬───────────────┘ │
│           │                    │                           │                 │
│           └────────────────────┼───────────────────────────┘                 │
│                                │                                             │
│                ┌───────────────┴───────────────┐                             │
│                │ Confirm-First Action Handoffs │                             │
│                │ Google Calendar | Maps | Gmail│                             │
│                └───────────────┬───────────────┘                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │ HTTPS / Secure WebSockets
                                 │ Bearer Firebase ID Token
┌────────────────────────────────▼─────────────────────────────────────────────┐
│                           SERVER TIER (Node/Express + TypeScript)            │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Firebase Token Verification → Server-Derived UID (Zero Trust Ownership) │ │
│  │ Zod Input Validation • Rate Limiting • Sanitization & Prompt Defense   │ │
│  └─────────────────────────────┬───────────────────────────────────────────┘ │
│                                │                                             │
│  ┌─────────────────────────────┼─────────────────────────────┐               │
│  │                             │                             │               │
│  ▼                             ▼                             ▼               │
│ Cloud Firestore         Vertex AI / Gemini           Gemini Live WebSocket   │
│ /users/{uid}/sessions   gemini-3.8-flash (Reflect)   gemini-2.0-flash-exp    │
│ /users/{uid}/memories   gemini-3.1-flash-lite (Task) Bidirectional Audio     │
│ /users/{uid}/documents  text-embedding-004 (Vector)  Real-time Companion     │
│ /users/{uid}/chunks                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                     Google Cloud Run (Container)
                      Region: asia-south1
```

---

## 6 Core Production Modules

### 1. Reflect Studio & Focus Mode
- **7 Distinct Reflection Modes**:
  - `Classic Reflect`: Warm, open-ended, non-judgmental inquiry.
  - `Deep Reflection`: Explores core beliefs, motivations, and underlying patterns.
  - `Brainstorm`: Expansive, generative exploration of possibilities.
  - `Reframe`: Constructive cognitive reframing of challenges and limiting beliefs.
  - `Action Plan`: Concrete next steps, friction identification, and accountability milestones.
  - `Gratitude`: Grounded presence, appreciation, and perspective.
  - `Executive Summary`: High-density synthesis of key points, decisions, and trajectory.
- **On-Demand Session Enrichment**: One-click **Summarize** and **Extract Actions** buttons generate structured cards right in the flow.
- **Focus Mode**: Distraction-free writing environment (`Cmd/Ctrl + Shift + F` or topbar icon) collapsing sidebars and context rails.
- **Continuation Engine**: Seamlessly fork or continue completed reflections into new threads while preserving parent context.

### 2. Live Voice Studio (Gemini Live Audio)
- **Real-Time Bidirectional Voice**: Built directly on the Gemini Live API via secure server-side WebSockets.
- **True 16-bit 24kHz Linear PCM**: Audio pipeline with lookahead buffering, sub-250ms jitter recovery, and odd-byte boundary alignment.
- **Responsive Audio Visualizer Orb**: Organic glowing canvas element pulsing in real time to speech input and assistant audio amplitude.
- **Live App Context Manifest**: Pushes active vault state (open loops, current focus, active documents) dynamically into Gemini's system instruction.
- **Voice-Driven Actions & Navigation**: The voice companion can propose navigation intents and structured action suggestions while speaking.

### 3. Memory Vault & Open Loops
- **User-Controlled Memory Lifecycle**: Memories are never silently extracted; the user explicitly reviews, edits, and saves key facts.
- **Verifiable Provenance**: Every saved memory maintains an immutable link to its source session ID, date, and conversation turn snippet.
- **Evolution & Decay**: Relevance scoring based on recency, importance, and reference count, with contradiction and supersession detection.
- **Open Loop Tracking**: Manage commitments across `active`, `snoozed`, and `completed` states without mental fatigue.

### 4. Vault Intelligence & Longitudinal Synthesis
- **Grounded "Ask My Vault"**: Conversational querying of all your reflections and memories with strict anti-hallucination bounds.
- **Insufficiency Awareness**: Calmly admits when information is missing rather than guessing.
- **"What Changed?" Longitudinal Synthesis**: Compares earlier reflections against recent entries to identify shifting priorities and evolving goals.
- **Grounded Weekly Review**: Synthesizes the past 7 days across 3 distinct epistemic tiers:
  - *Evidence*: Direct quotes and verified dates from your sessions.
  - *Interpretation*: Non-clinical AI observations on themes and patterns.
  - *Suggestions*: Practical questions and steps for the upcoming week.

### 5. Commitments & Planning Calendar
- **Commitment Timeline**: Longitudinal view of promises, deadlines, and intentions extracted from your journal.
- **Suggested Focus & Loop Tracking**: Deterministic focus recommendation and status tracking for open, snoozed, and resolved intentions.
- **Seasonal & Holiday Planning Catalog**: Deterministic awareness of upcoming seasons, quarters, and global holidays to prompt timely reflection.
- **One-Click Calendar Handoff**: Every commitment card includes an authentic **Add to Google Calendar** link pre-filled with context.

### 6. Document Studio & Semantic Retrieval
- **Multi-Format Ingestion**: Upload PDF documents, Markdown notes, or plain text files up to 10MB.
- **Security & Extraction**: Strictly validates `%PDF-` magic bytes, sanitizes filenames, and escapes content into passive XML.
- **Deterministic Vector Embeddings**: Document text is chunked with sliding context overlap and vectorized using `text-embedding-004`.
- **Hybrid Retrieval & Grounded Q&A**: Ranks chunks via cosine similarity, lexical matching, and recency, citing exact page numbers and excerpts.
- **Document Summaries & Action Extraction**: Generate high-level overviews or extract concrete action items directly from uploaded files.

---

## Confirm-First External Action Handoffs

Gemini Vault adheres to a strict architectural principle: **Never act on the user's behalf without explicit consent.**

Instead of requesting risky background OAuth scopes to silently write into calendars or send emails, Gemini Vault uses **Confirm-First Web URL Handoffs**:

```text
┌─────────────────────────────────────────────────────────────┐
│  AI detects action intent (calendar, navigation, maps, etc.)│
│                           ↓                                 │
│  Renders interactive Action Confirmation Card in the UI    │
│                           ↓                                 │
│  User reviews pre-filled details, dates, and recipients    │
│                           ↓                                 │
│  User clicks "Add to Calendar" / "Open Maps" / "Draft Email"│
│                           ↓                                 │
│  Opens authentic, pre-filled web interface for final submit │
└─────────────────────────────────────────────────────────────┘
```

- **Google Calendar**: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...`
- **Google Maps**: `https://www.google.com/maps/search/?api=1&query=...`
- **Gmail**: `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...`

This guarantees:
1. **Zero Silent Side Effects**: No event is ever booked, no email is ever sent, and no route is ever altered without the user's eyes on it.
2. **Zero Risky Scopes**: No third-party email/calendar read-write tokens stored in the cloud.
3. **Complete User Agency**: The user can adjust times, edit text, or discard suggestions in their native Google workflow.

---

## Security & Privacy Invariants

1. **Server-Derived Ownership**: Client-provided user IDs and model-generated document IDs are never trusted. All database reads and writes are keyed strictly by the verified Firebase UID from the decoded JWT.
2. **Strict User Scoping**: All user data is isolated under `/users/{uid}/...`. Cross-user data contamination is mathematically impossible in queries.
3. **Passive XML Prompt Defense**: Document text and user memories injected into AI prompts are wrapped in passive XML tags with prompt delimiters escaped.
4. **Non-Clinical Grounding**: Gemini Vault never outputs clinical psychological diagnoses or objective medical claims. All interpretations are presented as reflective observations.
5. **Sanitized Backups & Export**: Vault export (JSON or Markdown) strips all tokens, internal IDs, and raw vectors, delivering clean human-readable archives.

---

## Automated Test Suites (91/91 Passing)

Gemini Vault includes comprehensive test coverage across 6 automated test suites:

```text
✔ tests/voiceSessionLifecycle.test.ts (21 tests)
  - 16-bit PCM alignment, lookahead scheduling, odd-byte preservation, jitter recovery
  - OutputTranscription synchronization, titling state machine, ladder fallback

✔ tests/askVaultIntelligence.test.ts (16 tests)
  - Snoozed/completed/active filtering, topic retrieval, time bounds, provenance verification
  - Insufficient evidence handling, prompt injection neutralization, deterministic ordering

✔ tests/documentIntelligence.test.ts (30 tests)
  - Magic-byte validation, MIME filtering, size bounding, plain-text/PDF extraction
  - Deterministic chunking, embedding batching, hybrid ranking, citation correctness

✔ tests/finalProductEnhancements.test.ts (5 tests)
  - Manual memory creation, tone/depth bounds, location context validation
  - Vault Moments grounding contracts, What Changed insufficiency thresholds

✔ tests/exportAndPalette.test.ts (7 tests)
  - Deterministic ISO timestamps, credential sanitization, empty vault resilience
  - Markdown structured export, Command Palette search & keyboard bounds, Focus Mode contract

✔ tests/vaultIntelligenceFinal.test.ts (12 tests)
  - Google Calendar URL generation, all-day fallback, character bounds
  - Google Maps & Gmail URL handoffs, navigation target allowlist enforcement
  - Action intent regex detection, App Context Manifest builder, Planning catalog integrity
  - 7 Reflection Mode system prompt non-clinical constraints

Total: 91 passed, 0 failed (100% passing)
```

Run tests locally:
```bash
npm test
```

---

## Production Deployment

Gemini Vault is containerized with Docker and deployed on **Google Cloud Run** in the `asia-south1` region:

```bash
# Verify build
npm run build

# Run automated verification suite
npm test

# Deploy to Google Cloud Run
gcloud run deploy gemini-vault \
  --source . \
  --region asia-south1 \
  --project gemini-vault-507219 \
  --allow-unauthenticated \
  --update-labels dev-tutorial=cloud-run-ai-challenge
```

### Production Checklist
- [x] Live on Google Cloud Run: `https://gemini-vault-935700896025.asia-south1.run.app`
- [x] Google Cloud Run AI Challenge Label: `dev-tutorial=cloud-run-ai-challenge`
- [x] Firebase Authentication with Google Sign-In & persistence
- [x] Cloud Firestore user data isolation & security rules
- [x] Vertex AI integration with Google Cloud ADC
- [x] Real-time bidirectional WebSocket voice streaming
- [x] Confirm-first action handoffs (Calendar, Maps, Gmail)
- [x] 91/91 passing automated unit, integration, and security tests

---

## Local Development

### Prerequisites
- Node.js 20+
- Google Cloud Project with Vertex AI enabled
- Firebase Project with Authentication and Firestore enabled

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/dhruvm-06/gemini-vault.git
   cd gemini-vault
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   PORT=3000
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=global
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   ```
4. Run locally:
   ```bash
   npm run dev
   ```
5. Build and run production container locally:
   ```bash
   npm run build
   node dist/server.cjs
   ```

---

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System and product architecture |
| [MODEL-STRATEGY.md](docs/MODEL-STRATEGY.md) | Model routing and migration plan |
| [MEMORY-ENGINE.md](docs/MEMORY-ENGINE.md) | Relevance, decay, evolution and provenance |
| [VOICE-ARCHITECTURE.md](docs/VOICE-ARCHITECTURE.md) | Live voice design |
| [UI-DESIGN-SYSTEM.md](docs/UI-DESIGN-SYSTEM.md) | Visual and interaction system |
| [SECURITY.md](docs/SECURITY.md) | Security and trust boundaries |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloud Run and submission requirements |
| [GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md) | Git checkpoints and proof-of-work |
| [ROADMAP.md](docs/ROADMAP.md) | Product roadmap |

---

## Product Principles

1. **User Control** — The Vault remembers only what the user chooses; actions are never executed silently.
2. **Grounding** — Every AI insight and memory cite verifiable source evidence; when evidence is absent, the system calmly acknowledges it.
3. **Longitudinal Thinking** — The value is in thematic evolution, trajectory, and shifts over time, not isolated one-shot prompts.
4. **Simple Surface, Sophisticated Depth** — Clean, distraction-free editorial UI backed by rigorous multimodal infrastructure.
5. **Non-Clinical Grounding** — Reflective companionship, never psychological diagnosis or clinical claims.
6. **Immutable Provenance** — Every extracted memory links directly back to its source session and exact conversation turn.
7. **Security by Design** — Identity and resource ownership strictly derived server-side via verified Firebase credentials.

---

## License

Apache 2.0. Built with care for the Google Cloud Run AI Challenge.
