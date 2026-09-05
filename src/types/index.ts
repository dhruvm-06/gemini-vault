export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system' | 'night' | 'morning';
  reflectionReminder?: boolean;
  reflectionDepth?: 'concise' | 'balanced' | 'deep';
  conversationTone?: 'empathic' | 'direct' | 'philosophical';
  memorySuggestions?: boolean;
  evidenceVisibility?: 'expanded' | 'collapsed';
  defaultLocationMode?: 'none' | 'coarse' | 'precise';
  contextRailDefault?: 'open' | 'closed';
}

export interface LocationContext {
  mode: 'coarse' | 'precise';
  label: string;
  latitude?: number;
  longitude?: number;
  capturedAt: string;
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

export interface VoiceServerSessionTitledMessage {
  type: 'session_titled';
  title: string;
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
  | VoiceServerSessionTitledMessage
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

export interface MemoryEvolutionRecord {
  timestamp: string;
  sessionId: string;
  messageId?: string;
  previousFact: string;
  changeNote?: string;
}

export interface Memory {
  id: string;
  userId: string;
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  confidence: number;
  sourceSessionId: string | null;
  extractedBy: string;
  createdAt: unknown;
  isActive: boolean;
  sourceType?: 'extracted' | 'manual';

  // Phase D Provenance Extensions
  sourceMessageId?: string | null;
  sourceSnippet?: string | null;
  turnTimestamp?: string | null;
  sourceModality?: 'text' | 'voice' | null;

  // Phase D Evolution & Arbitration Extensions
  evolutionStatus?: 'active' | 'reinforced' | 'evolved' | 'superseded';
  supersedesMemoryId?: string | null;
  supersededByMemoryId?: string | null;
  evolutionHistory?: MemoryEvolutionRecord[];

  // Scoring & Loop Extensions
  loopStatus?: 'open' | 'snoozed' | 'resolved';
  snoozedUntil?: string | null;
  resolvedAt?: unknown;
  importance?: number;
  referenceCount?: number;
  lastReferencedAt?: unknown;
  memoryStatus?: 'active' | 'archived';
  updatedAt?: unknown;
}

export interface MemoryCandidate {
  id: string;
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  confidence: number;
  sourceSessionId: string;
  isSaved?: boolean;

  // Provenance
  sourceMessageId?: string;
  sourceSnippet?: string;
  turnTimestamp?: string;
  sourceModality?: 'text' | 'voice';

  // Contradiction detection
  conflictWithMemoryId?: string | null;
  conflictRationale?: string | null;
  evolutionType?: 'none' | 'reinforcement' | 'shift' | 'contradiction';
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
  sessionId?: string;
  sourceType?: 'extracted' | 'manual';
  fact: string;
  category: MemoryCategory;
  userNotes?: string;
  importance?: number;
  confidence?: number;
  sourceMessageId?: string | null;
  sourceSnippet?: string | null;
  turnTimestamp?: string | null;
  sourceModality?: 'text' | 'voice' | null;
  supersedesMemoryId?: string | null;
}

export interface VaultMoment {
  id: string;
  userId: string;
  title: string;
  narrative: string;
  occurredAt: string;
  createdAt: unknown;
  updatedAt?: unknown;
  memoryIds: string[];
  reflectionIds: string[];
  commitmentIds: string[];
  documentIds: string[];
  locationContext?: LocationContext | null;
  provenance: {
    sourceRecordCount: number;
    memoryCount: number;
    reflectionCount: number;
    commitmentCount?: number;
    documentCount?: number;
    synthesizedBy: string;
  };
  status: 'active' | 'archived';
}

export type AppView =
  | 'home'
  | 'voice'
  | 'vault'
  | 'intelligence'
  | 'documents'
  | 'calendar'
  | 'moments';

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

export * from './documents';
