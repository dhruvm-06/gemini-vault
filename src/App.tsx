import React, { useEffect, useState } from 'react';
import { Shield, Sparkles, Lock, Server, Fingerprint, AlertCircle, X } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { JournalHome } from './components/JournalHome';
import { JournalSessionView } from './components/JournalSessionView';

export default function App() {
  const {
    user,
    loading,
    error,
    signInWithGoogle,
    getIdToken,
    clearError,
  } = useAuth();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
});

const [initialPromptForSession, setInitialPromptForSession] =
  useState<string | undefined>(undefined);

const [isCreatingSession, setIsCreatingSession] = useState(false);

useEffect(() => {
  const handlePopState = () => {
    const params = new URLSearchParams(window.location.search);
    setActiveSessionId(params.get('session'));
    setInitialPromptForSession(undefined);
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}, []);

  // Start a new reflection session
  const handleStartNewSession = async (initialText?: string) => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          draftContent: initialText || '',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create new reflection session.');
      }

      const data = await res.json();
      const newSessionId = data.session?.id;
      if (newSessionId) {
  setInitialPromptForSession(initialText || undefined);
  setActiveSessionId(newSessionId);

  const url = new URL(window.location.href);
  url.searchParams.set('session', newSessionId);
  window.history.pushState({}, '', url);
}
    } catch (err) {
      console.error('[App] Error creating new session:', err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Resume an existing reflection session
  const handleResumeSession = (sessionId: string) => {
  setInitialPromptForSession(undefined);
  setActiveSessionId(sessionId);

  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.pushState({}, '', url);
};

  // Return to the reflection home list
  const handleBackToHome = () => {
  setActiveSessionId(null);
  setInitialPromptForSession(undefined);

  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  window.history.pushState({}, '', url);
};

  // Loading State
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-6 selection:bg-amber-500 selection:text-stone-950 font-sans">
        <div className="flex flex-col items-center space-y-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-serif font-medium text-stone-100">Opening Gemini Vault</h2>
            <p className="text-xs text-stone-400 mt-1">Authenticating encrypted session...</p>
          </div>
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Unauthenticated State (Landing & Sign-In Page)
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 font-sans">
        {/* Header */}
        <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-serif font-medium tracking-tight text-stone-100 text-lg">Gemini Vault</span>
            </div>
            <div className="text-xs font-serif text-stone-400">
              Private Socratic AI Journal
            </div>
          </div>
        </header>

        {/* Hero Landing */}
        <main className="max-w-4xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center">
          {error && (
            <div className="mb-8 w-full max-w-md p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start justify-between text-left font-sans">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-rose-200">Authentication Notice</span>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
              <button
                onClick={clearError}
                className="text-rose-400 hover:text-rose-200 p-1 -mr-1 -mt-1 cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Reflective Thought Environment</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-normal tracking-tight text-stone-100 leading-tight max-w-2xl mb-6">
            A reflective personal journal that helps you think clearly.
          </h1>

          <p className="text-sm sm:text-base text-stone-400 max-w-xl leading-relaxed mb-10 font-sans">
            Engage in multi-turn Socratic dialogues, unpack nuanced thoughts, and reflect with a calm AI companion strictly isolated to your private account.
          </p>

          {/* Google Sign-In Button */}
          <div className="flex flex-col items-center space-y-4 w-full max-w-sm">
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              id="google-signin-btn"
              className="w-full h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold flex items-center justify-center space-x-3 transition-all duration-150 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
            <p className="text-[11px] text-stone-500 font-sans">
              Passwordless &bull; Encrypted in Transit &bull; Private Isolation
            </p>
          </div>

          {/* Privacy & Architecture Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mt-16 text-left font-sans">
            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200 mb-1">Private Reflection</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Your entries and conversations are strictly isolated to your authenticated account.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Server className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200 mb-1">Socratic Companion</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Gemini listens attentively, asking insightful follow-up questions without unsolicited advice.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                <Fingerprint className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-200 mb-1">Durable History</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Pick up where you left off at any time. Sessions remain saved and searchable in your personal vault.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-stone-800 py-6 bg-stone-950 font-sans">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <div>&copy; 2026 Gemini Vault &mdash; Google Cloud Gen AI APAC Cohort 3</div>
            <div className="text-stone-500">
              Private Thought Sanctuary
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated State (Multi-Turn Journaling Experience)
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950">
      <Navigation onGoHome={handleBackToHome} />

      <main className="flex-1 w-full">
        {activeSessionId ? (
          <JournalSessionView
            sessionId={activeSessionId}
            onBack={handleBackToHome}
            initialPrompt={initialPromptForSession}
          />
        ) : (
          <JournalHome
            onStartNewSession={handleStartNewSession}
            onResumeSession={handleResumeSession}
            isCreating={isCreatingSession}
          />
        )}
      </main>

      {!activeSessionId && (
        <footer className="border-t border-stone-800 py-6 bg-stone-950 font-sans">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <div>&copy; 2026 Gemini Vault &mdash; Google Cloud Gen AI APAC Cohort 3</div>
            <div className="text-stone-500 font-serif">
              Your private space to think clearly
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
