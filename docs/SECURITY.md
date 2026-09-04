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

## Authorization

The authenticated token UID is authoritative.

Never trust:
- a client-provided userId
- client-provided ownership fields
- client claims about session status
- model-generated document IDs

## Firestore isolation

Data is organized under:

`/users/{uid}/...`

Rules and server checks must prevent cross-user access.

## AI security

Before sending context to Gemini:
- select only the minimum necessary records
- bound context size
- distinguish data from instructions
- defend against prompt injection inside stored content
- never expose internal system prompts
- never include credentials or secrets

## Model output

Never trust model output as an authorization decision.

For structured output:
1. parse
2. validate schema
3. verify IDs against the authenticated user's known data
4. only then persist/use the result

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
