import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, CheckCircle2, Server, Terminal, Lock, RefreshCw, AlertCircle } from 'lucide-react';

interface HealthStatus {
  status: string;
  service: string;
  timestamp?: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data: HealthStatus = await res.json();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-stone-100 text-lg">Gemini Vault</span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">
                Stage 1: Foundation
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-stone-400">GCP Project:</span>
              <span className="text-stone-200 font-medium">gemini-vault-507219</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full">
        {/* Hero Section */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-stone-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Google Cloud Gen AI APAC Cohort 3 Ideathon</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-100 leading-tight mb-4">
            Privacy-First Personal AI Journal
          </h1>
          <p className="text-lg text-stone-400 leading-relaxed">
            Gemini Vault is a reflective, Socratic AI journal designed with authenticated, UID-based Firestore data isolation, multi-turn synthesis, and persistent personal memory.
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Backend Status Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-stone-200 font-medium">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>Backend Health</span>
                </div>
                <button
                  onClick={checkHealth}
                  disabled={loading}
                  aria-label="Refresh backend health check"
                  className="p-1.5 rounded-md hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="py-4 text-stone-500 text-sm font-mono flex items-center space-x-2">
                  <span className="w-3 h-3 border-2 border-stone-600 border-t-transparent rounded-full animate-spin"></span>
                  <span>Verifying /api/health...</span>
                </div>
              ) : error ? (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                  <div className="flex items-center space-x-1.5 font-semibold mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Connection Error</span>
                  </div>
                  <p className="font-mono">{error}</p>
                </div>
              ) : health ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Status: {health.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs font-mono text-stone-400">
                    <div>Service: <span className="text-stone-200">{health.service}</span></div>
                    {health.timestamp && (
                      <div className="text-stone-500 mt-1">Checked: {new Date(health.timestamp).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 text-[11px] font-mono text-stone-500">
              Endpoint: GET /api/health
            </div>
          </div>

          {/* Architecture Status Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-stone-200 font-medium mb-4">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Security Architecture</span>
              </div>
              <ul className="space-y-2.5 text-xs text-stone-400">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Field-Level Firestore Rules (v3)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Server-Side Gemini Fallback Ladder</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>UID-Bound Admin SDK Verification</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 text-[11px] font-mono text-stone-500">
              Target: Cloud Run + Secret Manager
            </div>
          </div>

          {/* Dependencies Stack Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-stone-200 font-medium mb-4">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Runtime Stack</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="px-2.5 py-1.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                  React 19
                </div>
                <div className="px-2.5 py-1.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                  Express 5
                </div>
                <div className="px-2.5 py-1.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                  @google/genai
                </div>
                <div className="px-2.5 py-1.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                  Firebase Admin
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 text-[11px] font-mono text-stone-500">
              Port: 3000 (Unified Single Process)
            </div>
          </div>
        </div>

        {/* Roadmap Preview */}
        <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-stone-200 uppercase tracking-wider mb-4">
            Next Roadmap Stages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/60">
              <div className="font-mono text-amber-400 font-semibold mb-1">Stage 2</div>
              <div className="text-stone-200 font-medium">Auth & Rules</div>
              <p className="text-stone-500 text-[11px] mt-1">Google Sign-In & strict Firestore security</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/60">
              <div className="font-mono text-stone-500 font-semibold mb-1">Stage 3</div>
              <div className="text-stone-200 font-medium">Socratic Chat</div>
              <p className="text-stone-500 text-[11px] mt-1">Multi-turn conversation with Gemini</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/60">
              <div className="font-mono text-stone-500 font-semibold mb-1">Stage 4</div>
              <div className="text-stone-200 font-medium">Summarizer & Memory</div>
              <p className="text-stone-500 text-[11px] mt-1">Automated session insights & facts</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/60">
              <div className="font-mono text-stone-500 font-semibold mb-1">Stage 5-8</div>
              <div className="text-stone-200 font-medium">Reflections & Timeline</div>
              <p className="text-stone-500 text-[11px] mt-1">Search, Weekly Review & "What Changed?"</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800 py-6 bg-stone-950">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div>
            &copy; 2026 Gemini Vault &mdash; Google Cloud Gen AI APAC Cohort 3 Ideathon
          </div>
          <div className="flex items-center space-x-4 font-mono">
            <span>Project: gemini-vault-507219</span>
            <span>&bull;</span>
            <span>Region: asia-south1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
