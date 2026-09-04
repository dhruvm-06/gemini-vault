# Gemini Vault Feature Matrix

Status reflects the current implementation baseline and the planned V2 direction.

| Capability | Status | Notes |
|---|---|---|
| Google Sign-In | Implemented | Firebase Authentication |
| User-scoped Firestore | Implemented | Server + Firestore isolation |
| Multi-turn reflection | Implemented | Gemini + persistent messages |
| Resume after refresh | Implemented | URL session state |
| Reflection continuation | Implemented | New linked active session |
| Editable active titles | Implemented | Manual user control |
| Gemini retry handling | Implemented | Graceful failure state |
| User-approved memory | Implemented | Save/Edit/Dismiss flow |
| Memory provenance | Implemented | Source session |
| Thread grouping | Implemented | rootSessionId |
| Ask My Vault | Implemented | Explicit saved memories only |
| Hybrid relevance ranking | Foundation | Recency/reinforcement/importance/context |
| Open Loops | Foundation | Goal/commitment lifecycle evolving |
| Vault Signals | Foundation | AI enrichment + deterministic preview |
| What Changed | Foundation | Full longitudinal synthesis pending |
| Weekly Review | Foundation | Deterministic snapshot; deeper synthesis pending |
| Memory evolution | Planned | Contradiction/supersession model |
| Memory decay | Foundation/Planned | Retrieval priority, not deletion |
| Voice Reflection | Planned | Gemini Live |
| Document RAG | Planned | Embeddings + citations |
| Vault Moments | Planned | Visual life archive |
| Vault-wide search | Planned | Cross-source retrieval |
| Calendar integration | Planned | User-authorized context |
| Gmail integration | Planned | User-authorized summaries |
| Collaborative archives | Planned | RBAC |
| Light theme | Planned | Intentional Morning Vault |
| Dark theme | Current baseline | Night Vault direction |
| Global design system | Planned | V2 architecture |
| E2E browser testing | Planned | Antigravity-assisted |
| Security audit | Planned | Full V2 review |
| Cloud Run deployment | Target | Submission requirement |
