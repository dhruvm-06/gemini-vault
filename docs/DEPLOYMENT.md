# Gemini Vault Deployment

## Production target

Google Cloud Run.

## AI access

Use the Cloud Run service identity / ADC for Vertex AI.

Grant only the required IAM permissions.

## Required challenge label

The deployed Cloud Run service MUST have:

```text
dev-tutorial=cloud-run-ai-challenge
```

This label is part of the ideathon deployment verification.

## Production checklist

```text
Build
 ↓
Run tests
 ↓
Verify environment
 ↓
Deploy Cloud Run
 ↓
Verify service health
 ↓
Verify auth
 ↓
Verify Gemini
 ↓
Verify Firestore
 ↓
Verify Cloud Run label
 ↓
Verify public URL
 ↓
Run browser smoke test
 ↓
Commit/push evidence
```

## Voice

For WebSocket-based voice:
- configure a suitable Cloud Run request timeout
- implement reconnect
- consider session affinity
- do not enable end-to-end HTTP/2 for the WebSocket path unless the architecture explicitly supports it
- test long-lived connections and concurrency

## Required submission artifacts

- public working Cloud Run URL
- public GitHub repository
- README
- Firestore rules
- public demo/social post
- completed Ideathon Prototype Submission dashboard fields
