# Gemini Vault — Agent Constitution

## Mission
Build Gemini Vault into a production-grade private AI reflection workspace.

Product promise:
**Think freely. Remember what matters.**

Core loop:
**Reflect → Understand → Remember → Notice change → Reflect again**

## Non-negotiables
1. Preserve working authentication, session persistence, continuation, memory approval, and error recovery.
2. GitHub is the source of truth and the audit trail.
3. Never make a large repo-wide rewrite without first inspecting the current repository.
4. Prefer additive changes and small reversible commits.
5. Do not silently remove an existing user-facing feature while editing another area.
6. Server derives ownership from the verified Firebase UID.
7. Never trust client-provided ownership or model-generated document IDs.
8. Bound all AI context.
9. Use AI only where it adds meaningful value; deterministic facts should remain deterministic.
10. Never present non-clinical AI observations as diagnoses or objective psychological facts.
11. User-approved memories must remain user-controlled.
12. Every major milestone must build, browser-test, commit, and push to GitHub.

## Current product areas
- Reflect: text reflection, threads, continuation, future voice mode
- Vault: memories, open loops, provenance, future documents/moments
- Intelligence: Ask My Vault, Signals, What Changed, Weekly Review, future Growth & Evolution
- Search: future Vault-wide search

## Coding-agent workflow
Audit → plan → implement → build → browser-test → security-check → commit → push.

## Do not
- create endless production-vXX files in the repository
- duplicate endpoints for convenience
- expose API keys in the browser
- dump all memories into every prompt
- use tiny UI text for normal content
- turn the UI into a card-heavy analytics dashboard
