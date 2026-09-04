# Gemini Vault Memory Engine

## Product philosophy

A memory is not just a retrieved sentence.

The Vault should understand:
- whether the memory was explicitly approved
- when it first appeared
- whether it was reinforced
- whether it is still relevant
- whether newer reflections may have changed it
- which reflection(s) support it

## Current memory

Current memory fields include:

```text
id
userId
fact
category
userNotes
confidence
sourceSessionId
extractedBy
createdAt
isActive
loopStatus
```

Newer implementation work also introduces:

```text
memoryStatus
importance
referenceCount
lastReferencedAt
```

## Target memory lifecycle

```text
Candidate
   ↓
User approval
   ↓
Active
   ↓
Referenced / reinforced
   ↓
Possible evolution
   ↓
Dormant / superseded / archived
```

## Decay

Decay must NOT delete user data.

Decay should reduce retrieval priority over time.

Conceptual ranking:

```text
Score =
  semantic relevance
+ recency
+ reinforcement
+ explicit importance
+ current-thread relevance
+ open-loop relevance
- decay
```

## Contradiction / evolution

Example:

Earlier:
"I want a stable corporate role."

Later:
"I do not think a traditional corporate role fits me anymore."

Do not treat both as equally current facts.

Instead represent:

```text
earlier memory
    ↓
new conflicting evidence
    ↓
possible evolving preference
    ↓
human-readable cautious synthesis
```

Language should remain uncertainty-aware:
- "may be changing"
- "appears to be evolving"
- "your recent reflections suggest"

Avoid:
- diagnosis
- personality labels
- absolute psychological claims

## Provenance

Future target:

```text
firstSeenSessionId
latestSessionId
sourceSessions[]
sourceMessageIds[]
reinforcedCount
lastReinforcedAt
contradictionCount
lastContradictedAt
supersedesMemoryId
```

This enables:
**Why does Vault remember this?**

The user should be able to inspect the supporting reflection.

## Retrieval

Do not inject all memories into every prompt.

Use:
1. candidate generation
2. relevance ranking
3. bounded selection
4. grounded model call
5. output validation

Ask My Vault should return optional grounding metadata so the UI can explain what was used.
