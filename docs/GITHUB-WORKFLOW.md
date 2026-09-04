# Gemini Vault GitHub Workflow

GitHub is the source of truth, recovery system, and proof-of-work trail.

## Rule

No major feature is complete until it is:

```text
Implemented
→ Built
→ Browser-tested
→ Security-checked
→ Committed
→ Pushed
```

## Commit style

Prefer specific commits:

```text
feat: add memory provenance
feat: add reflection continuation
feat: add voice reflection
feat: add document retrieval
refactor: introduce design system
fix: stabilize response scrolling
security: harden memory authorization
test: cover reflection lifecycle
docs: add architecture and model strategy
```

Avoid:
- update
- changes
- final
- final2
- fix stuff

## Milestone tags

Use only for meaningful milestones.

Suggested future tags:

```text
v1.0-core
v1.1-memory
v1.2-intelligence
v2.0-design-system
v2.1-voice
v2.2-rag
v2.3-longitudinal-intelligence
v3.0-production
```

## AI-agent rule

Antigravity/AI Studio may experiment, but the repository remains the canonical source.

Do not maintain a second "AI-generated" source of truth.
