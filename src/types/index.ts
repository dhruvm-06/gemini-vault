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
}

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

export type AppView = 'home' | 'vault' | 'intelligence';
