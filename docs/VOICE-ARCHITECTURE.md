# Gemini Vault Voice Reflection Architecture

## Product goal

Voice is a first-class reflection modality, not a microphone button attached to text chat.

The user should be able to move between:

**Text ↔ Voice**

inside the same reflection identity.

## Experience

### Text mode

- normal multi-turn reflection
- keyboard-first composer
- same session/thread/memory model

### Voice mode

Immersive workspace:

```text
Reflection title

           [ Live presence ]

        Listening...
        Thinking...
        Speaking...

       00:42

      End reflection
```

Voice should feel distinct but remain part of the same reflection.

## Data model

The same session should ultimately support:

```text
session
├── text turns
├── voice turns
├── transcript
├── memories
└── thread linkage
```

## Realtime flow

```text
Microphone
   ↓
Gemini Live connection
   ↓
audio-to-audio model
   ↓
streamed audio + transcript
   ↓
session transcript
   ↓
memory/thread processing
```

## Target model

`gemini-3.1-flash-live-preview`

It is specifically designed for low-latency real-time dialogue and supports text, image, audio and video input with text/audio output.

## Cloud Run

Cloud Run supports WebSockets without extra configuration, but WebSocket requests still observe the configured request timeout. Production voice must therefore include:
- reconnect logic
- appropriate timeout
- optional session affinity
- careful connection lifecycle handling
- testing of long-lived sessions
- graceful fallback on disconnect

## Security

The browser must not receive privileged service credentials.

Realtime session setup should be authenticated and bounded to the user's identity and intended session.

## UX quality bar

Voice must not be presented as:
"Speech-to-text + normal chat."

It should feel like:
**a calm, dedicated live reflection space.**
