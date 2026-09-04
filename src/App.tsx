import React, { useEffect, useState, useMemo } from 'react';
import { Shield, Mic, FileText, Calendar, Compass, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { JournalHome } from './components/JournalHome';
import { JournalSessionView } from './components/JournalSessionView';
import { VaultDashboard } from './components/VaultDashboard';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';
import { AppShell } from './components/AppShell';
import { LandingPage } from './components/LandingPage';
import { AppView, ContextRailItem } from './types';
import { VaultPresence } from './components/VaultPresence';

const VALID_VIEWS: AppView[] = ['home', 'voice', 'vault', 'intelligence', 'documents', 'calendar'];

function parseViewFromParam(param: string | null): AppView {
  if (param && (VALID_VIEWS as string[]).includes(param)) {
    return param as AppView;
  }
  return 'home';
}

export default function App() {
  const auth = useAuth();
  const { user, loading, error, signInWithGoogle, signOutUser, getIdToken, clearError } = auth;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('session');
  });
  const [sessionInitialMode, setSessionInitialMode] = useState<'text' | 'voice'>(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'voice' ? 'voice' : 'text';
  });
  const [initialPromptForSession, setInitialPromptForSession] = useState<string | undefined>();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [reflectContextItems, setReflectContextItems] = useState<ContextRailItem[]>([]);
  const [view, setView] = useState<AppView>(() => {
    const raw = new URLSearchParams(window.location.search).get('view');
    return parseViewFromParam(raw);
  });

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');
      const viewParam = params.get('view');
      const modeParam = params.get('mode');
      setActiveSessionId(sessionParam);
      setSessionInitialMode(modeParam === 'voice' ? 'voice' : 'text');
      setInitialPromptForSession(undefined);
      setReflectContextItems([]);
      if (viewParam && (VALID_VIEWS as string[]).includes(viewParam)) {
        setView(viewParam as AppView);
      } else if (
        event.state &&
        typeof (event.state as { returnView?: string }).returnView === 'string'
      ) {
        const returnView = (event.state as { returnView: AppView }).returnView;
        setView(parseViewFromParam(returnView));
      } else if (!sessionParam) {
        setView('home');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (nextView: AppView) => {
    setNavigationError(null);
    setActiveSessionId(null);
    setInitialPromptForSession(undefined);
    setReflectContextItems([]);
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    url.searchParams.delete('mode');
    url.searchParams.set('view', nextView);
    window.history.pushState({ view: nextView }, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const openSession = (
    sessionId: string,
    initialPrompt?: string,
    initialMode: 'text' | 'voice' = 'text'
  ) => {
    setNavigationError(null);
    setInitialPromptForSession(initialPrompt);
    setSessionInitialMode(initialMode);
    setActiveSessionId(sessionId);
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    if (initialMode === 'voice') {
      url.searchParams.set('mode', 'voice');
    } else {
      url.searchParams.delete('mode');
    }
    url.searchParams.delete('view');
    window.history.pushState(
      { session: sessionId, returnView: view, mode: initialMode },
      '',
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const startVoiceSession = async () => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const now = new Date();
      const title = `Voice Reflection: ${now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, draftContent: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create voice reflection.');
      const newSessionId = data.session?.id;
      if (!newSessionId) throw new Error('Reflection session was not created.');

      openSession(newSessionId, undefined, 'voice');
    } catch (err) {
      console.error('[App] Failed to create voice reflection:', err);
      setNavigationError(err instanceof Error ? err.message : 'Failed to create voice reflection.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleBackFromSession = () => {
    setReflectContextItems([]);
    if (
      window.history.state &&
      typeof (window.history.state as { returnView?: string }).returnView === 'string'
    ) {
      const returnView = (window.history.state as { returnView: AppView }).returnView;
      navigate(parseViewFromParam(returnView));
      return;
    }
    navigate(view === 'home' ? 'home' : view);
  };

  const startSession = async (initialText?: string) => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ draftContent: initialText || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create reflection.');
      const newSessionId = data.session?.id;
      if (!newSessionId) throw new Error('Reflection session was not created.');

      const starterPrompt = initialText?.trim()
        ? initialText.trim()
        : 'Begin this reflection by asking me one thoughtful, open-ended question about what is currently occupying my mind. Keep it natural and concise.';
      openSession(newSessionId, starterPrompt);
    } catch (err) {
      console.error('[App] Failed to create reflection:', err);
      setNavigationError(err instanceof Error ? err.message : 'Failed to create reflection.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const continueSession = async (sessionId: string) => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ continuedFromSessionId: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to continue reflection.');
      const newSessionId = data.session?.id;
      if (!newSessionId) throw new Error('Continuation session was not created.');

      openSession(
        newSessionId,
        'I want to continue and rework the ideas from this earlier reflection. Help me revisit them thoughtfully and explore what has changed.'
      );
    } catch (err) {
      console.error('[App] Failed to continue reflection:', err);
      setNavigationError(err instanceof Error ? err.message : 'Failed to continue reflection.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Build contextual rail items based on current view and state
  const contextItems = useMemo<ContextRailItem[]>(() => {
    if (activeSessionId) {
      if (reflectContextItems.length > 0) {
        return reflectContextItems;
      }
      return [
        {
          id: 'ctx-session-active',
          kind: 'evidence',
          title: 'Active Reflection Stream',
          body: 'Your thoughts are being anchored securely in your personal vault. Take all the space you need.',
        },
      ];
    }

    switch (view) {
      case 'home':
        return [
          {
            id: 'prompt-1',
            kind: 'prompt',
            title: 'Morning Clarity',
            body: 'What intention or challenge is calling for your attention most clearly today?',
            actionLabel: 'Reflect on this',
            onAction: () =>
              void startSession('What intention or challenge is calling for my attention most clearly today?'),
          },
          {
            id: 'prompt-2',
            kind: 'prompt',
            title: 'Unpacking an Open Loop',
            body: 'Are there any lingering decisions, commitments, or tensions currently on your mind?',
            actionLabel: 'Unpack loop',
            onAction: () =>
              void startSession('I want to unpack an open loop or pending decision that is currently on my mind.'),
          },
          {
            id: 'prompt-3',
            kind: 'prompt',
            title: 'Notice Shift & Growth',
            body: 'Look back across the past few days. What has begun to shift in your perspective?',
            actionLabel: 'Explore shift',
            onAction: () =>
              void startSession('Reflecting on recent shifts: What feels different in my work and thinking right now?'),
          },
        ];

      case 'vault':
        return [
          {
            id: 'ctx-vault-1',
            kind: 'memory',
            title: 'Grounded Memory Structure',
            body: 'Memories are categorized into goals, projects, preferences, and recurring themes. You maintain full ownership to edit or delete.',
          },
          {
            id: 'ctx-vault-2',
            kind: 'loop',
            title: 'Open Loops Tracked',
            body: 'Unresolved commitments and thoughts are automatically organized so nothing falls through the cracks.',
          },
        ];

      case 'intelligence':
        return [
          {
            id: 'ctx-intel-1',
            kind: 'evidence',
            title: 'Direct Vault Grounding',
            body: 'Ask My Vault queries your reflection history and approved memories with strict semantic attribution and citation provenance.',
          },
          {
            id: 'ctx-intel-2',
            kind: 'commitment',
            title: 'Evolution Over Time',
            body: 'Signals continuously monitor recurring patterns, thematic drift, and progress toward declared intentions.',
          },
        ];

      case 'voice':
        return [
          {
            id: 'ctx-voice-1',
            kind: 'citation',
            title: 'Live Spoken Stream',
            body: 'Continuous bidirectional native audio with sub-20ms barge-in interruption and unified session lineage.',
          },
        ];

      case 'documents':
        return [
          {
            id: 'ctx-docs-1',
            kind: 'citation',
            title: 'Source Grounding',
            body: 'Upload personal notes, essays, and reading journals to ground reflections in your own sources.',
          },
        ];

      case 'calendar':
        return [
          {
            id: 'ctx-cal-1',
            kind: 'commitment',
            title: 'Action Alignment',
            body: 'Scheduled commitments and focus blocks verified and server-mediated with your explicit personal confirmation.',
          },
        ];

      default:
        return [];
    }
  }, [view, activeSessionId]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] flex items-center justify-center transition-colors duration-200">
        <div className="text-center">
          <Shield className="w-7 h-7 text-[var(--gv-accent)] mx-auto animate-pulse" />
          <h2 className="mt-4 text-lg font-serif">Opening Gemini Vault</h2>
          <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Authenticating your private space…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage
        onSignIn={signInWithGoogle}
        loading={loading}
        error={error}
        onClearError={clearError}
      />
    );
  }

  return (
    <AppShell
      currentView={view}
      onNavigate={navigate}
      activeSessionId={activeSessionId}
      user={user}
      onSignOut={signOutUser}
      navigationError={navigationError}
      onDismissError={() => setNavigationError(null)}
      contextItems={contextItems}
      onOpenSession={openSession}
    >
      {activeSessionId ? (
        <JournalSessionView
          key={activeSessionId}
          sessionId={activeSessionId}
          onBack={handleBackFromSession}
          onContinueSession={continueSession}
          initialPrompt={initialPromptForSession}
          initialMode={sessionInitialMode}
          onContextItemsChange={setReflectContextItems}
        />
      ) : view === 'vault' ? (
        <VaultDashboard onOpenSession={openSession} onContinueSession={continueSession} />
      ) : view === 'intelligence' ? (
        <IntelligenceDashboard onOpenSession={openSession} />
      ) : view === 'voice' ? (
        <div className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto animate-fade-in">
          <button
            type="button"
            onClick={startVoiceSession}
            disabled={isCreatingSession}
            className="group relative flex flex-col items-center justify-center p-8 rounded-3xl bg-[var(--gv-surface-raised)]/50 border border-[var(--gv-border-default)] hover:border-[var(--gv-accent)]/60 transition duration-300 cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50"
            aria-label="Start Voice Reflection"
            title="Start Voice Reflection"
          >
            <VaultPresence size="large" state="idle" label="Live Voice Core Ready" />
            <div className="mt-5 flex items-center gap-2 text-xs font-medium text-[var(--gv-accent)] group-hover:underline">
              <Mic className="w-3.5 h-3.5" />
              <span>{isCreatingSession ? 'Opening Voice Reflection…' : 'Tap to Speak with Vault Presence'}</span>
            </div>
          </button>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gv-accent)] animate-pulse" />
            <span>Spoken Reflection Studio</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-[var(--gv-text-primary)] mt-3 font-medium">
            Voice Reflection Studio
          </h2>
          <p className="mt-3 text-sm text-[var(--gv-text-secondary)] leading-relaxed max-w-md">
            Continuous, real-time spoken reflection powered by low-latency audio streaming with zero transcript lag.
            Speaks, listens, and understands naturally with instant interruption.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={startVoiceSession}
              disabled={isCreatingSession}
              id="start-voice-studio-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-medium hover:opacity-90 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isCreatingSession ? 'Opening…' : 'Enter Voice Reflection'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-[var(--gv-text-primary)] text-xs font-medium hover:bg-[var(--gv-surface-raised)]/80 transition cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Reflect in Text</span>
            </button>
          </div>
        </div>
      ) : view === 'documents' ? (
        <div className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] flex items-center justify-center mb-5">
            <FileText className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--gv-accent-gold)] px-3 py-1 rounded-full bg-[var(--gv-accent-gold)]/10 border border-[var(--gv-accent-gold)]/30">
            Source Grounding
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[var(--gv-text-primary)] mt-4 font-medium">
            Documents & Grounding
          </h2>
          <p className="mt-3 text-sm text-[var(--gv-text-secondary)] leading-relaxed">
            Upload and ground your reflections in personal notes, PDFs, essays, and reading journals with strict semantic citations.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('vault')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-[var(--gv-text-primary)] text-xs font-medium hover:bg-[var(--gv-surface-raised)]/80 transition cursor-pointer"
            >
              <span>Explore Vault Memories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : view === 'calendar' ? (
        <div className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] flex items-center justify-center mb-5">
            <Calendar className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--gv-accent-gold)] px-3 py-1 rounded-full bg-[var(--gv-accent-gold)]/10 border border-[var(--gv-accent-gold)]/30">
            Action Alignment
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl text-[var(--gv-text-primary)] mt-4 font-medium">
            Commitments & Calendar
          </h2>
          <p className="mt-3 text-sm text-[var(--gv-text-secondary)] leading-relaxed">
            Bridge your reflective insights into scheduled intentions, focus blocks, and loop closures with verified human confirmation.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('intelligence')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-[var(--gv-text-primary)] text-xs font-medium hover:bg-[var(--gv-surface-raised)]/80 transition cursor-pointer"
            >
              <span>Open Intelligence & Loops</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <JournalHome
          onStartNewSession={startSession}
          onResumeSession={openSession}
          onContinueSession={continueSession}
          isCreating={isCreatingSession}
        />
      )}
    </AppShell>
  );
}