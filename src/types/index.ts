export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
  reflectionReminder?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences?: UserPreferences;
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL?: string | null;
}

export interface JournalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  clientTimestamp?: string;
  timestamp?: unknown;
  modality?: 'text' | 'voice';
  audioDurationMs?: number;
  interrupted?: boolean;
  transcriptStatus?: 'interim' | 'final';
}

export type VoiceSessionStatus =
  | 'unauthenticated'
  | 'connecting'
  | 'authenticated'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'concluded'
  | 'error';

export interface VoiceClientAuthMessage {
  type: 'auth';
  token: string;
}

export interface VoiceClientAudioMessage {
  type: 'audio_chunk';
  data: string; // base64-encoded raw 16kHz 16-bit mono PCM
}

export interface VoiceClientEndOfTurnMessage {
  type: 'end_of_turn';
}

export interface VoiceClientRefreshMessage {
  type: 'auth_refresh';
  token: string;
}

export interface VoiceClientInterruptMessage {
  type: 'user_interrupted';
}

export interface VoiceClientConcludeMessage {
  type: 'conclude_session';
}

export type VoiceClientMessage =
  | VoiceClientAuthMessage
  | VoiceClientAudioMessage
  | VoiceClientEndOfTurnMessage
  | VoiceClientRefreshMessage
  | VoiceClientInterruptMessage
  | VoiceClientConcludeMessage;

export interface VoiceServerAuthenticatedMessage {
  type: 'authenticated';
  uid: string;
}

export interface VoiceServerReadyMessage {
  type: 'ready';
  sessionId: string;
}

export interface VoiceServerStateChangeMessage {
  type: 'state_change';
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'reconnecting' | 'ended';
}

export interface VoiceServerInterimTranscriptMessage {
  type: 'interim_transcript';
  role: 'user' | 'assistant';
  text: string;
}

export interface VoiceServerAudioChunkMessage {
  type: 'audio_chunk';
  pcm: string; // base64-encoded 24kHz 16-bit mono PCM
}

export interface VoiceServerTurnPersistedMessage {
  type: 'turn_persisted';
  message: JournalMessage;
}

export interface VoiceServerInterruptedMessage {
  type: 'interrupted';
  assistantTurnId?: string;
  finalContent?: string;
}

export interface VoiceServerSessionConcludedMessage {
  type: 'session_concluded';
  sessionId: string;
}

export interface VoiceServerSessionWarningMessage {
  type: 'session_warning';
  minutesRemaining: number;
}

export interface VoiceServerErrorMessage {
  type: 'error';
  code: string;
  message: string;
  fatal?: boolean;
}

export type VoiceServerMessage =
  | VoiceServerAuthenticatedMessage
  | VoiceServerReadyMessage
  | VoiceServerStateChangeMessage
  | VoiceServerInterimTranscriptMessage
  | VoiceServerAudioChunkMessage
  | VoiceServerTurnPersistedMessage
  | VoiceServerInterruptedMessage
  | VoiceServerSessionConcludedMessage
  | VoiceServerSessionWarningMessage
  | VoiceServerErrorMessage;

export interface JournalSession {
  id: string;
  userId: string;
  title: string;
  draftContent?: string;
  clientStartedAt?: string;
  createdAt?: unknown;
  status: 'active' | 'completed' | 'abandoned';
  endedAt?: unknown;
  wordCount?: number;
  summary?: string;
  keyInsights?: string[];
  mood?: string;
  moodScore?: number;
  tags?: string[];
}

export interface JournalChatRequest {
  sessionId: string;
  message: string;
  clientMessageId?: string;
}

export interface JournalChatResponse {
  userMessage: JournalMessage;
  assistantMessage: JournalMessage;
}

export type MemoryCategory =
  | 'goal'
  | 'project'
  | 'preference'
  | 'important_context'
  | 'recurring_theme'
  | 'commitment';

export interface Memory {
  id: string;
  userId: string;
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  confidence: number;
  sourceSessionId: string;
  extractedBy: string;
  createdAt: unknown;
  isActive: boolean;
}

export interface MemoryCandidate {
  id: string;
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  confidence: number;
  sourceSessionId: string;
  isSaved?: boolean;
}

export interface ExtractMemoriesRequest {
  sessionId: string;
}

export interface ExtractMemoriesResponse {
  success: boolean;
  sessionId: string;
  candidates: MemoryCandidate[];
  warning?: string;
}

export interface SaveMemoryRequest {
  sessionId: string;
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  confidence?: number;
}

export type AppView =
  | 'home'
  | 'voice'
  | 'vault'
  | 'intelligence'
  | 'documents'
  | 'calendar';

export type ContextRailItemKind =
  | 'memory'
  | 'loop'
  | 'commitment'
  | 'prompt'
  | 'evidence'
  | 'citation';

export interface ContextRailItem {
  id: string;
  kind: ContextRailItemKind;
  title: string;
  body: string;
  timestamp?: string;
  sourceSessionId?: string;
  actionLabel?: string;
  onAction?: () => void;
}
