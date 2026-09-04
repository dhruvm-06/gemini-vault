# Gemini Vault Model Strategy

## Current baseline

The current codebase uses Vertex AI through `@google/genai` and Application Default Credentials/server identity.

Current primary conversational model in the implementation:
`gemini-3.1-flash-lite`

Current fallback:
`gemini-2.5-flash`

## Target routing strategy

### 1. Main text reflection
Target:
`gemini-3.8-flash`

Role:
- primary conversational reflection
- richer reasoning
- nuanced contradiction handling
- multi-step longitudinal synthesis when required

Use lower thinking for latency-sensitive conversational turns and higher thinking selectively for deeper analysis.

### 2. Lightweight structured work
Target:
`gemini-3.1-flash-lite`

Role:
- memory candidate extraction
- simple classification
- bounded metadata generation
- other high-throughput tasks

### 3. Voice Reflection
Target:
`gemini-3.1-flash-live-preview`

Role:
- real-time audio-to-audio dialogue
- live reflection mode
- streamed audio + transcript

### 4. Semantic / multimodal retrieval
Target:
`gemini-embedding-2-preview`

Role:
- semantic retrieval
- cross-modal retrieval
- future document/image/audio discovery
- theme clustering

## Model-routing principle

Do not use the strongest model for every operation.

Use:
- high-quality Flash for user-visible complex reasoning
- lightweight Flash-Lite for bounded structured tasks
- Live for realtime voice
- embeddings for retrieval

## Migration warning

Gemini 3.x model migrations require an explicit configuration audit. In particular, deprecated sampling parameters such as `temperature`, `top_p`, and `top_k` should not simply be carried forward blindly. Review the current SDK/API configuration before switching the production text model.

## Reliability principle

Every model-backed feature must have:
- bounded context
- explicit grounding rules
- structured validation where applicable
- deterministic fallback where practical
- user-visible failure state
