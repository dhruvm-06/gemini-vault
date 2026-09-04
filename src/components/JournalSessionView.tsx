import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  RotateCcw,
  User,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession, JournalMessage } from '../types';
import { FormattedResponse } from './FormattedResponse';
import { MemoryReviewSection } from './MemoryReviewSection';

interface JournalSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onContinueSession?: (sessionId: string) => Promise<void>;
  initialPrompt?: string;
}

export const JournalSessionView: React.FC<JournalSessionViewProps> = ({
  sessionId,
  onBack,
  onContinueSession,
  initialPrompt,
}) => {
  const { getIdToken } = useAuth();

  const [session, setSession] = useState<JournalSession | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; lastFailedText?: string; clientMsgId?: string } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [isReviewingMemories, setIsReviewingMemories] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const assistantMessageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [scrollTargetAssistantId, setScrollTargetAssistantId] = useState<string | null>(null);
  const [scrollTargetUserId, setScrollTargetUserId] = useState<string | null>(null);
  const focusAfterResponseRef = useRef(false);
  const initialPromptSentRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(null);

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Adjust textarea height dynamically
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  };

  // Clicking the quiet canvas should behave like ChatGPT-style composer focus:
  // typing can begin without requiring a click on the textarea itself.
  // Chat-style "type anywhere" behavior.
  // Use a document-level listener so it still works when the user clicks the
  // canvas/body and the textarea is no longer the active element.
  useEffect(() => {
    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (
        loadingSession ||
        isSending ||
        isReviewingMemories ||
        session?.status === 'completed' ||
        !textareaRef.current ||
        event.isComposing
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const target = event.target as HTMLElement | null;
      const isFormControl =
        target?.closest('input, textarea, select, button, a, [contenteditable="true"]');

      // Never hijack typing that is intentionally happening in another control.
      if (isFormControl) return;

      event.preventDefault();

      setInputText((previous) => previous + event.key);

      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true });
      });
    };

    document.addEventListener('keydown', handleGlobalTyping);
    return () => document.removeEventListener('keydown', handleGlobalTyping);
  }, [loadingSession, isSending, isReviewingMemories, session?.status]);

  const handleSessionCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      loadingSession ||
      isSending ||
      isReviewingMemories ||
      session?.status === 'completed' ||
      !textareaRef.current
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    // Do not steal focus while the user is selecting/copying conversation text.
    const selectedText = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (selectedText) {
      return;
    }

    textareaRef.current.focus({ preventScroll: true });
  };

  // Load session metadata and messages
  const loadSession = async () => {
  if (loadedSessionRef.current === sessionId) {
    return;
  }

  loadedSessionRef.current = sessionId;

  setLoadingSession(true);
  setSendError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/journal/session/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load reflection session');
      }

      const data = await res.json();
      setSession(data.session);
      setEditTitleValue(data.session?.title || '');
      setMessages(data.messages || []);

      // If initialPrompt was provided and no messages exist yet, send the initial prompt
      if (
  initialPrompt &&
  (!data.messages || data.messages.length === 0) &&
  !initialPromptSentRef.current
) {
  initialPromptSentRef.current = true;

  setTimeout(() => {
    sendMessage(initialPrompt);
  }, 100);
}
    } catch (err: unknown) {
  loadedSessionRef.current = null;
  console.error('[JournalSessionView] Error loading session:', err);
  setSendError({ message: 'Unable to retrieve conversation history. Please refresh.' });
} finally {
      setLoadingSession(false);
      setTimeout(() => scrollToBottom('auto'), 150);
    }
  };

  useEffect(() => {
    initialPromptSentRef.current = false;
    loadedSessionRef.current = null;
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText]);

  // Initial load: place the user at the latest content once.
  useEffect(() => {
    if (!loadingSession && messages.length > 0) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [loadingSession, sessionId]);

  // When a follow-up message is sent, immediately bring the start of that
  // user turn into view while Gemini is generating the response.
  // This mirrors the conversational viewport behavior users expect from ChatGPT.
  useLayoutEffect(() => {
    const userId = scrollTargetUserId;
    if (!userId) return;

    setScrollTargetUserId(null);

    requestAnimationFrame(() => {
      const target = assistantMessageRefs.current.get(userId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [scrollTargetUserId]);

  // After Gemini actually returns, bring that exact assistant response into view
  // and return the cursor to the composer on desktop.
  useLayoutEffect(() => {
    const assistantId = scrollTargetAssistantId;
    if (!assistantId) return;

    setScrollTargetAssistantId(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = assistantMessageRefs.current.get(assistantId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          scrollToBottom('smooth');
        }

        if (focusAfterResponseRef.current) {
          focusAfterResponseRef.current = false;
          if (typeof window !== 'undefined' && window.innerWidth >= 768 && !isReviewingMemories && session?.status !== 'completed') {
            requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
          }
        }
      });
    });
  }, [scrollTargetAssistantId, isReviewingMemories, session?.status]);

  // Send message to backend Gemini endpoint
  const sendMessage = async (contentToSend?: string, existingClientMsgId?: string) => {
    const text = (contentToSend ?? inputText).trim();
    if (!text || isSending) return;

    const token = await getIdToken();
    if (!token) {
      setSendError({ message: 'Authentication required. Please sign in again.' });
      return;
    }

    const clientMsgId = existingClientMsgId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // If it's a new message (not a retry), add user message optimistically to UI
    const optimisticUserMsg: JournalMessage = {
      id: clientMsgId,
      role: 'user',
      content: text,
      clientTimestamp: new Date().toISOString(),
    };

    if (!existingClientMsgId) {
      // For follow-up turns, scroll to the beginning of the new user message
      // immediately, before Gemini starts generating.
      if (messages.length > 0) {
        setScrollTargetUserId(clientMsgId);
      }

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch('/api/journal/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          message: text,
          clientMessageId: clientMsgId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gemini companion was unable to respond.');
      }

      // Append assistant message or update message list
      if (data.assistantMessage) {
  setScrollTargetAssistantId(data.assistantMessage.id);
  focusAfterResponseRef.current = true;
  setMessages((prev) => {
    const updated = [...prev];

    // Replace the optimistic user message with the
    // canonical server message instead of appending another one.
    const optimisticIndex = updated.findIndex((m) => m.id === clientMsgId);

    if (optimisticIndex !== -1 && data.userMessage) {
      updated[optimisticIndex] = data.userMessage;
    } else if (data.userMessage) {
      updated.push(data.userMessage);
    }

    // Prevent duplicate assistant messages.
    const assistantExists = updated.some(
      (m) => m.id === data.assistantMessage.id
    );

    if (!assistantExists) {
      updated.push(data.assistantMessage);
    }

    return updated;
  });
}
    } catch (err: unknown) {
      console.error('[JournalSessionView] Send error:', err);
      const errMsg = err instanceof Error ? err.message : 'An error occurred while contacting Gemini.';
      setSendError({
        message: errMsg,
        lastFailedText: text,
        clientMsgId,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key for sending
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Save edited session title
  const handleSaveTitle = async () => {
    const trimmed = editTitleValue.trim();
    if (!trimmed || trimmed === session?.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/journal/session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        setSession((prev) => (prev ? { ...prev, title: trimmed } : null));
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error('[JournalSessionView] Error saving title:', err);
    }
  };

  // Conclude the current reflection
  const handleConcludeSession = async () => {
  setIsConcluding(true);

  try {
    const token = await getIdToken();
    if (!token) return;

    const res = await fetch(`/api/journal/session/${sessionId}/conclude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to conclude reflection.');
    }

    setSession((prev) =>
      prev ? { ...prev, status: 'completed' } : null
    );

    setShowConcludeModal(false);
    setIsReviewingMemories(true);
  } catch (err) {
    console.error('[JournalSessionView] Error concluding session:', err);
  } finally {
    setIsConcluding(false);
  }
};

  if (loadingSession) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4 font-sans">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-stone-400 font-serif">Opening reflection session...</p>
      </div>
    );
  }

  const isCompleted = session?.status === 'completed';

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-[calc(100vh-4rem)]"
    >
    
      {/* Session Header */}
      <header className="pb-4 border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition cursor-pointer"
            aria-label="Back to Reflections"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-stone-900 border border-amber-500/50 text-stone-100 text-sm focus:outline-none font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 rounded bg-amber-500 text-stone-950 hover:bg-amber-400"
                aria-label="Save title"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="p-1 rounded bg-stone-800 text-stone-400 hover:text-stone-200"
                aria-label="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h1 className="font-serif text-base sm:text-lg font-medium text-stone-100 max-w-md truncate">
                {session?.title || 'Reflection Session'}
              </h1>
              {!isCompleted && (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-stone-500 hover:text-stone-300 transition cursor-pointer"
                  aria-label="Edit title"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {isCompleted ? (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[11px] font-sans font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Concluded</span>
            </span>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-sans font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Active</span>
              </span>

              <button
                onClick={() => setShowConcludeModal(true)}
                id="conclude-reflection-btn"
                className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-stone-100 text-xs font-sans font-medium border border-stone-800 transition cursor-pointer"
              >
                Conclude reflection
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Conversation Area */}
      <div
        className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 font-sans cursor-text"
        onClick={handleSessionCanvasClick}
        aria-label="Reflection conversation"
      >
        {messages.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base font-serif text-stone-200">The canvas is yours.</h2>
            <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
              Express whatever thoughts are present. Gemini will listen attentively and provide reflective follow-up questions.
            </p>
            <p className="text-[11px] text-stone-600 pt-1">
              Click anywhere in this space to start typing.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                {/* Speaker Label */}
                <div className="flex items-center space-x-1.5 text-[11px] text-stone-500 uppercase tracking-wider px-1">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="w-3 h-3 text-stone-400" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400/90 font-medium">Gemini Vault</span>
                    </>
                  )}
                </div>

                {/* Message Body */}
                <div
                  ref={(node) => {
                    const id = msg.id;
                    if (!id) return;
                    if (node) assistantMessageRefs.current.set(id, node);
                    else assistantMessageRefs.current.delete(id);
                  }}
                  className={`max-w-2xl p-4 sm:p-5 rounded-2xl leading-relaxed text-sm ${
                    isUser
                      ? 'bg-stone-800 text-stone-100 border border-stone-700/80 rounded-tr-sm shadow-sm'
                      : 'bg-stone-950/80 text-stone-200 border border-stone-800 rounded-tl-sm shadow-md font-serif text-[15px]'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <FormattedResponse content={msg.content} />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isSending && (
          <div className="flex flex-col items-start space-y-1.5">
            <div className="flex items-center space-x-1.5 text-[11px] text-amber-400 uppercase tracking-wider px-1">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>Reflecting with Gemini...</span>
            </div>
            <div className="p-4 rounded-2xl rounded-tl-sm bg-stone-950 border border-stone-800 flex items-center space-x-2 text-stone-400 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}

        {/* Retryable Error Banner */}
        {sendError && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-rose-200">Reflection Interrupted</span>
                <p className="mt-0.5 text-[11px] text-rose-300/90">{sendError.message}</p>
              </div>
            </div>

            {sendError.lastFailedText && (
              <button
                onClick={() => sendMessage(sendError.lastFailedText, sendError.clientMsgId)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center space-x-1.5 self-start sm:self-auto shrink-0 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Reflection</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Immediate post-conclusion Vault Memory review */}
      {isReviewingMemories && session?.status === 'completed' && (
        <div
          className="fixed inset-0 z-40 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vault Memory review"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-800 bg-stone-950 shadow-2xl">
            <MemoryReviewSection
              sessionId={sessionId}
              sessionTitle={session?.title || 'Reflection'}
              getIdToken={getIdToken}
              onDone={onBack}
            />
          </div>
        </div>
      )}

      {/* Composer or Concluded Footer */}
      <footer className="pt-3 border-t border-stone-800 shrink-0">
        {isCompleted ? (
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-center space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>This reflection is concluded and archived.</span>
              </div>
              <p className="text-[11px] text-stone-500 font-sans">
                All messages remain preserved securely in your personal vault.
              </p>
            </div>
            {onContinueSession && (
              <div className="pt-1">
                <button
                  type="button"
                  id="continue-reflection-btn"
                  onClick={() => onContinueSession(sessionId)}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Continue Reflection</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative flex items-end rounded-xl bg-stone-950 border border-stone-800 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50 transition">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue your reflection... (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={isSending}
                className="w-full p-3.5 pr-12 bg-transparent text-stone-100 placeholder-stone-500 text-sm focus:outline-none resize-none font-sans leading-relaxed max-h-[220px]"
              />

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isSending}
                id="send-message-btn"
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition disabled:opacity-30 disabled:hover:bg-amber-500 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-stone-500">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">Shift+Enter</kbd> for newline</span>
              <span className="hidden sm:inline">Protected by Gemini Vault isolation</span>
            </div>
          </div>
        )}
      </footer>

      {/* Conclude Session Confirmation Modal */}
      {showConcludeModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-base font-serif font-medium text-stone-100">Conclude this reflection?</h2>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                Concluding marks the session as finished and preserves this conversation in your personal vault. You can review it at any time.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConcludeModal(false)}
                disabled={isConcluding}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition cursor-pointer"
              >
                Keep Active
              </button>
              <button
                onClick={handleConcludeSession}
                disabled={isConcluding}
                id="confirm-conclude-btn"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isConcluding ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Concluding...</span>
                  </>
                ) : (
                  <span>Conclude Reflection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
