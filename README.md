# Gemini Vault

> **Think freely. Remember what matters.**

Gemini Vault is a private, authenticated AI reflection workspace built around a simple idea: an AI journal should remember what the user deliberately chooses to keep, understand how those memories evolve, and help the user return to meaningful thoughts over time.

## Product loop

```text
Reflect → Understand → Remember → Notice change → Reflect again
```

## Why Gemini Vault is different

Traditional journals primarily store entries.

Gemini Vault is designed around **longitudinal reflection**:

- multi-turn Gemini reflection rather than one-shot prompts
- user-controlled memory extraction
- reflection threads and continuation
- open intentions and commitments
- grounded Ask My Vault
- longitudinal signals and change detection
- future voice, document intelligence, and life-archive capabilities

The product goal is not to create a psychological diagnosis engine. It is a private reflection system that helps users organize and revisit their own thinking.

---

## Current technology

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend | Node/Express + TypeScript |
| Authentication | Firebase Authentication / Google Sign-In |
| Data | Cloud Firestore |
| AI | Google Gemini through `@google/genai` + Vertex AI |
| Hosting | Google Cloud Run |
| Validation | Zod |
| UI icons | Lucide |

### Current AI baseline

The current stable implementation uses:

```text
Primary conversational model:
gemini-3.1-flash-lite

Fallback:
gemini-2.5-flash
```

The production migration plan evaluates **Gemini 3.8 Flash** for richer text reflection and longitudinal synthesis, while keeping lightweight models for bounded high-throughput tasks.

Voice will use a Live model, and multimodal retrieval will use Gemini Embedding 2 once those subsystems are implemented.

---

## Security architecture

```text
Firebase Authentication
        ↓
verified Firebase UID
        ↓
server authorization
        ↓
user-scoped Firestore
        ↓
bounded AI context
        ↓
Gemini / Vertex AI
        ↓
validated result
        ↓
UI
```

The browser does not receive privileged Vertex AI credentials.

The server controls ownership metadata and verifies that referenced sessions and memories belong to the authenticated user.

AI-generated IDs are never trusted without server-side verification.

AI context is explicitly bounded and grounded.

---

## Firestore structure

```text
/users/{uid}

/users/{uid}/sessions/{sessionId}
/users/{uid}/sessions/{sessionId}/messages/{messageId}

/users/{uid}/memories/{memoryId}
```

### Sessions

Sessions support:

- active reflection
- completed/archive state
- editable active titles
- continuation from completed reflections
- root thread linkage

### Memories

A saved memory can include:

- fact
- category
- user notes
- source session
- confidence
- created time
- active/archive state
- importance
- reference count
- open-loop state

Memory creation is explicitly user-controlled.

---

## Current product areas

### Reflect

- new reflection
- multi-turn Gemini conversation
- persistent sessions
- URL-based resume
- browser history synchronization
- Enter to send
- Shift+Enter for newline
- click-anywhere/type interaction
- automatic turn scrolling
- automatic post-response composer focus
- conclusion/archive
- continuation/rework

### Vault

- saved memories
- session-level provenance
- reflection-thread grouping
- Open Loop foundation
- memory editing
- source-reflection navigation
- hybrid memory relevance foundation

### Intelligence

- Ask My Vault
- Vault Signals
- recent themes
- reflection activity
- What Changed foundation
- Weekly Review foundation

---

## Planned flagship capabilities

### Voice Reflection

A first-class live conversation mode:

```text
Text ↔ Voice
     ↓
Same reflection session
     ↓
Transcript
     ↓
Memory / thread
```

The intent is an immersive Valeria-inspired voice workspace rather than a microphone button attached to ordinary chat.

### Memory Evolution

Memories should support:

- relevance
- temporal decay
- reinforcement
- contradiction
- possible supersession
- provenance

Decay reduces retrieval priority. It does not silently delete user data.

### What Changed?

Compare earlier and recent reflections to surface:

- themes
- shifts
- evolving goals
- possible changes in priorities

Every AI observation should remain uncertainty-aware and inspectable.

### Weekly Review

A grounded weekly synthesis:

- explored
- remembered
- revisited
- left open
- something that changed
- one useful next reflection

### Document Intelligence

Future document-aware reflection with:

- secure uploads
- chunking/retrieval
- semantic embeddings
- page/section provenance
- grounded answers

### Vault Moments

A future life-archive layer combining:

- images
- reflections
- documents
- people
- memories
- evolving narratives

### Search

Future Vault-wide search across:

- reflections
- threads
- memories
- open loops
- documents
- moments

---

## Reliability principles

The project deliberately separates AI enrichment from critical user flows.

Examples:

```text
Core session load
     ↓
usable immediately

AI signal enrichment
     ↓
runs in background
```

Critical operations should not become unavailable because a secondary AI enrichment request is slow.

Core reflection behavior has been hardened against:

- duplicate initial requests
- duplicate user messages
- disappearing first messages
- refresh state loss
- continuation errors
- stale Firestore timestamp handling
- Gemini retry/failure states

---

## Model-routing philosophy

Gemini Vault should not use one expensive model for every job.

```text
Conversation
    ↓
High-quality Flash

Memory extraction
    ↓
Lightweight Flash-Lite

Live voice
    ↓
Live audio model

Semantic retrieval
    ↓
Embedding model

Longitudinal synthesis
    ↓
High-quality Flash with selective reasoning
```

The exact model IDs are maintained in `docs/MODEL-STRATEGY.md`.

---

## Development workflow

GitHub is the authoritative project record.

```text
Plan
 ↓
Implement
 ↓
Build
 ↓
Browser test
 ↓
Security check
 ↓
Commit
 ↓
Push
 ↓
Next milestone
```

Do not maintain generated `production-vXX` files as an alternative source of truth.

---

## Production deployment

Target:

**Google Cloud Run**

Required challenge verification label:

```text
dev-tutorial=cloud-run-ai-challenge
```

Before final submission:

```text
Build
→ Test
→ Deploy
→ Verify public URL
→ Verify Cloud Run label
→ Verify authentication
→ Verify Gemini
→ Verify Firestore isolation
→ Browser smoke test
→ Public GitHub repository
→ Demo/social post
→ Submission dashboard
```

See [DEPLOYMENT.md](DEPLOYMENT.md).

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

## Product principles

1. **User control** — the Vault remembers what the user chooses.
2. **Grounding** — AI observations must have identifiable data support.
3. **Longitudinal thinking** — history matters more than isolated entries.
4. **Simple surface, sophisticated system** — users should not need to understand the internal architecture.
5. **No diagnosis** — the product is reflective, not clinical.
6. **Provenance** — users should be able to understand where remembered context came from.
7. **Security by design** — identity, ownership and AI context boundaries are enforced server-side.
