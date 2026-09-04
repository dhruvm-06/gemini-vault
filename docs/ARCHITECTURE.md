# Gemini Vault Architecture

## Product architecture

Gemini Vault is a private, authenticated, longitudinal reflection system.

```text
                 Gemini Vault
                      |
        +-------------+-------------+
        |             |             |
      Reflect        Vault      Intelligence
        |             |             |
   +----+----+     +---+---+    +----+---------+
   |         |     |       |    |    |    |     |
  Text     Voice  Memory  Loops Ask  Signals Changes Review
   |         |     |       |
   +---------+-----+-------+
             |
       Reflection / Thread
             |
       Memory + Provenance
             |
     Retrieval / Relevance
             |
           Gemini
```

## Runtime flow

```text
Firebase Auth
    ↓
verified Firebase UID
    ↓
server authorization
    ↓
Firestore user scope
    ↓
bounded context construction
    ↓
Gemini/Vertex AI
    ↓
validated model result
    ↓
UI
```

## Firestore scope

```text
/users/{uid}
/users/{uid}/sessions/{sessionId}
/users/{uid}/sessions/{sessionId}/messages/{messageId}
/users/{uid}/memories/{memoryId}
```

## Reflection lifecycle

```text
New
 ↓
Active multi-turn reflection
 ↓
Conclude
 ↓
Memory suggestions
 ↓
User approval
 ↓
Completed / immutable source
 ↓
Continue
 ↓
New linked active reflection
```

## Thread lifecycle

Sessions are linked with:
- rootSessionId
- continuedFromSessionId

The root represents the broader reflection thread. The individual session remains the immutable historical unit.

## Design principle

Desktop should use horizontal space efficiently:
- global navigation at top
- primary workspace in the center
- contextual information only where useful
- vertical scrolling mainly for conversation/history

Mobile should convert side context into drawers rather than compressing the desktop layout.

## Reliability requirements

- URL-based active session persistence
- optimistic user-message reconciliation
- canonical server message IDs
- retryable Gemini failure state
- bounded AI payloads
- graceful enrichment failure
- loading states that do not block unrelated content
