import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Clock, ArrowRight, BookOpen, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession } from '../types';

interface JournalHomeProps {
  onStartNewSession: (initialText?: string) => Promise<void>;
  onResumeSession: (sessionId: string) => void;
  isCreating: boolean;
}

export const JournalHome: React.FC<JournalHomeProps> = ({
  onStartNewSession,
  onResumeSession,
  isCreating,
}) => {
  const { getIdToken, user } = useAuth();
  const [initialThought, setInitialThought] = useState('');
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    setLoadError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/journal/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load reflection history');
      }

      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      console.error('[JournalHome] Error loading sessions:', err);
      setLoadError('Unable to load past reflections. Please try again.');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onStartNewSession(initialThought.trim());
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Editorial Hero Header */}
      <section className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Private Reflective Companion</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif text-stone-100 font-normal tracking-tight">
          Your private space to think clearly.
        </h1>
        <p className="text-stone-400 text-sm sm:text-base max-w-lg mx-auto font-sans leading-relaxed">
          Unpack thoughts, examine motivations, and explore perspectives through thoughtful dialogue.
        </p>
      </section>

      {/* Primary Reflection Composer / Start Card */}
      <section className="p-6 sm:p-8 rounded-2xl bg-stone-950 border border-stone-800 shadow-xl relative overflow-hidden">
        <form onSubmit={handleStartSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="initial-thought" className="text-xs font-semibold uppercase tracking-wider text-stone-300">
              Start a new reflection
            </label>
            <span className="text-xs text-stone-500">Press Enter to begin</span>
          </div>

          <textarea
            id="initial-thought"
            value={initialThought}
            onChange={(e) => setInitialThought(e.target.value)}
            placeholder="What is currently on your mind? An unmade decision, a subtle feeling, or a recurring challenge..."
            rows={3}
            className="w-full p-4 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition resize-none font-sans leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isCreating) {
                  onStartNewSession(initialThought.trim());
                }
              }
            }}
          />

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-stone-500 font-sans">
              Encrypted in transit &bull; User-isolated storage
            </div>
            <button
              type="submit"
              disabled={isCreating}
              id="start-reflection-btn"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Opening Vault...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Begin Reflection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Active & Resumable Sessions */}
      {activeSessions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Active Reflections in Progress</span>
            </h2>
            <span className="text-xs text-stone-500">{activeSessions.length} active</span>
          </div>

          <div className="space-y-3">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onResumeSession(session.id)}
                className="p-4 sm:p-5 rounded-xl bg-stone-950 hover:bg-stone-900 border border-amber-500/30 hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1.5 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <h3 className="text-sm font-medium text-stone-100 group-hover:text-amber-300 transition">
                      {session.title || 'Untitled Reflection'}
                    </h3>
                  </div>
                  {session.draftContent && (
                    <p className="text-xs text-stone-400 truncate max-w-md font-sans">
                      {session.draftContent}
                    </p>
                  )}
                  <div className="text-[11px] text-stone-500 font-sans flex items-center space-x-3">
                    <span>Active Session</span>
                    {session.wordCount ? <span>&bull; ~{session.wordCount} words</span> : null}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform shrink-0">
                  <span>Resume</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Reflection History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Past Reflections</span>
          </h2>
          {completedSessions.length > 0 && (
            <span className="text-xs text-stone-500">{completedSessions.length} completed</span>
          )}
        </div>

        {loadError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{loadError}</span>
          </div>
        )}

        {loadingSessions ? (
          <div className="p-8 text-center text-stone-500 text-xs font-sans flex flex-col items-center justify-center space-y-2">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading reflection vault...</span>
          </div>
        ) : completedSessions.length === 0 ? (
          <div className="p-8 rounded-xl bg-stone-950/40 border border-stone-800/60 text-center space-y-2">
            <p className="text-xs text-stone-400 font-sans">No concluded reflections yet.</p>
            <p className="text-[11px] text-stone-500">
              When you conclude an active session, it will be safely archived here in your personal vault.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-800/80 rounded-xl bg-stone-950 border border-stone-800 overflow-hidden">
            {completedSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onResumeSession(session.id)}
                className="p-4 hover:bg-stone-900/60 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1 pr-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                    <h3 className="text-xs font-medium text-stone-200 group-hover:text-stone-100">
                      {session.title || 'Concluded Reflection'}
                    </h3>
                  </div>
                  <div className="text-[11px] text-stone-500 font-sans flex items-center space-x-3">
                    <span>Completed</span>
                    {session.wordCount ? <span>&bull; {session.wordCount} words</span> : null}
                  </div>
                </div>

                <div className="text-stone-500 group-hover:text-stone-300 transition shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
