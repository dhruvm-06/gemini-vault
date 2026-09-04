# Gemini Vault Security Model

## Trust boundary

```text
Browser
   ↓
Firebase ID token
   ↓
server verification
   ↓
authenticated UID
   ↓
user-scoped Firestore
   ↓
bounded AI context
   ↓
validated model response
```

## Authentication

Firebase Authentication provides user identity.

The server must verify the Firebase ID token for protected routes.

## Authorization & Identifier Validation

The authenticated token UID is authoritative.

Never trust:
- a client-provided userId
- client-provided ownership fields
- client claims about session status
- model-generated document IDs

### Input-Shape Validation vs. Authorization
All document identifiers (`sessionId`, `memoryId`, `clientMessageId`, `continuedFromSessionId`) are syntactically validated against `^[a-zA-Z0-9_-]{1,128}$`.
Syntactic validation is input-shape validation only and does **not** replace authorization. Every Firestore access must be scoped under `/users/${req.user.uid}/...`.

## HTTP Security Headers & Content Security Policy (CSP)

The server enforces strict HTTP security headers via `securityHeaders` middleware:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Required to preserve Firebase Google Sign-In popup communication)
- `Cross-Origin-Embedder-Policy: unsafe-none` (Preserves loading of Google user profile photos from `lh3.googleusercontent.com`)

### Environment-Aware CSP
- **Development**: Permits Vite HMR WebSockets (`ws://*`) and development scripts.
- **Production**: Strictly hardened:
  - Eliminates `unsafe-eval`.
  - Scopes Google/Firebase origins narrowly to exact application endpoints (`accounts.google.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`, `lh3.googleusercontent.com`, and the project auth domain).
  - Blocks framing except from authorized Google Auth domains.

## API Rate Limiting

Process-local in-memory rate limiting protects expensive Vertex AI endpoints:
- `POST /api/journal/chat`
- `POST /api/memories/extract`
- `POST /api/memories/ask`
- `GET /api/memories/signals`

### Single-Instance Rate Limiter Boundary
The in-memory rate limiter operates strictly within the local Node.js process. It is designed to prevent runaway client loops, rapid UI spamming, and local abuse. It is **not** a globally synchronized distributed limiter across multiple Cloud Run instances (which would require Redis / Memorystore / Cloud Armor) and is not presented as complete distributed abuse protection.
- Keys on verified `req.user.uid` following authentication middleware; falls back to `req.ip`.
- Configurable per-endpoint limits via environment variables.
- Returns HTTP 429 with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
- Static assets and health checks are never rate-limited.

## AI Security & Prompt Injection Defense

Before sending context to Gemini:
- Select only the minimum necessary records (bounded context).
- Distinguish invariant model instructions from untrusted user data.
- Enclose untrusted user data in defense-in-depth boundary tags:
  - `<vault_memory_records>`: Memory context in Ask My Vault.
  - `<vault_data>` (`<saved_memories>`, `<completed_reflections>`): Context in Vault Signals.
  - `<session_transcript>`: Reflection transcript in Memory Extraction.
  - `<continuation_context>`: Historical reflection context in multi-turn chat.
- Sanitize input text by escaping closing delimiter tags to prevent tag breakout.
- Invariant system instructions explicitly command the model to treat all data inside boundary tags strictly as passive data and disregard any embedded commands, persona shifts, or instructions to disclose system prompts.
- **Defense-in-depth notice**: Structural delimitation and prompt engineering reduce the probability of indirect prompt injection but do not provide mathematical guarantees against all adversarial jailbreaks.

## Model Output & Model-Generated IDs

Never trust model output as an authorization decision.

For structured output:
1. Parse JSON safely.
2. Validate schema with Zod.
3. Validate candidate IDs syntactically (`^[a-zA-Z0-9_-]{1,128}$`).
4. Verify candidate IDs against the authenticated user's actual Firestore document IDs before accepting or returning them.
5. Only then persist or use the result.

## Memory safety

Memory extraction must exclude:
- secrets
- credentials
- speculative claims
- medical/mental-health diagnoses
- temporary states
- invented details

User-approved memories remain user-controlled.

## Production secret handling

Do not expose privileged credentials in frontend code.

Vertex AI should use server identity / ADC in Cloud Run.

Secret Manager is reserved for actual secrets that need secret storage.
