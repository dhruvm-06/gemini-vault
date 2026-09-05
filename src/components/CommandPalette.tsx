import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Search,
  Compass,
  Mic,
  Bookmark,
  Brain,
  FileText,
  Calendar,
  Settings,
  PlusCircle,
  Sparkles,
  Download,
  Sun,
  Moon,
  X,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AppView } from '../types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onStartNewReflection: () => void;
  onOpenNewMemory: () => void;
  onOpenAskVault: () => void;
  onExportVault: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  currentTheme: 'night' | 'morning';
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

interface CommandItem {
  id: string;
  group: 'Navigate' | 'Actions' | 'Preferences';
  label: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onStartNewReflection,
  onOpenNewMemory,
  onOpenAskVault,
  onExportVault,
  onOpenSettings,
  onToggleTheme,
  currentTheme,
  isFocusMode = false,
  onToggleFocusMode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const navigationSourceRef = useRef<'keyboard' | 'mouse'>('keyboard');

  // Define commands catalog
  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Actions
      {
        id: 'act-new-reflection',
        group: 'Actions',
        label: 'New Reflection',
        description: 'Start a new Socratic reflection session',
        keywords: ['write', 'journal', 'start', 'new', 'session', 'prompt'],
        icon: PlusCircle,
        shortcut: 'N',
        action: () => {
          onClose();
          onStartNewReflection();
        },
      },
      {
        id: 'act-new-memory',
        group: 'Actions',
        label: 'New Personal Memory',
        description: 'Record an enduring fact, goal, or preference directly in your Vault',
        keywords: ['add', 'memory', 'manual', 'create', 'fact', 'goal', 'commitment'],
        icon: Sparkles,
        shortcut: 'M',
        action: () => {
          onClose();
          onOpenNewMemory();
        },
      },
      {
        id: 'act-ask-vault',
        group: 'Actions',
        label: 'Ask My Vault',
        description: 'Query your personal memory engine with grounded longitudinal intelligence',
        keywords: ['ask', 'search', 'query', 'intelligence', 'retrieve', 'where did i say'],
        icon: Brain,
        shortcut: 'A',
        action: () => {
          onClose();
          onOpenAskVault();
        },
      },
      {
        id: 'act-export-vault',
        group: 'Actions',
        label: 'Export My Vault',
        description: 'Download a complete, sanitized copy of your Vault data (JSON/MD)',
        keywords: ['export', 'download', 'backup', 'portability', 'privacy', 'archive'],
        icon: Download,
        shortcut: 'E',
        action: () => {
          onClose();
          onExportVault();
        },
      },

      // Navigation
      {
        id: 'nav-reflect',
        group: 'Navigate',
        label: 'Reflect Studio',
        description: 'Return to the main reflection canvas and active sessions',
        keywords: ['home', 'reflect', 'journal', 'dashboard', 'overview'],
        icon: Compass,
        action: () => {
          onClose();
          onNavigate('home');
        },
      },
      {
        id: 'nav-voice',
        group: 'Navigate',
        label: 'Voice Studio',
        description: 'Real-time spoken reflection with live audio streaming',
        keywords: ['voice', 'speak', 'audio', 'talk', 'mic', 'studio'],
        icon: Mic,
        action: () => {
          onClose();
          onNavigate('voice');
        },
      },
      {
        id: 'nav-vault',
        group: 'Navigate',
        label: 'Vault & Memories',
        description: 'Browse approved memories, open loops, and longitudinal evolution',
        keywords: ['vault', 'memories', 'loops', 'commitments', 'knowledge', 'history'],
        icon: Bookmark,
        action: () => {
          onClose();
          onNavigate('vault');
        },
      },
      {
        id: 'nav-intelligence',
        group: 'Navigate',
        label: 'Vault Intelligence',
        description: 'Longitudinal signals, what changed analysis, and weekly review',
        keywords: ['intelligence', 'signals', 'what changed', 'review', 'insights'],
        icon: Brain,
        action: () => {
          onClose();
          onNavigate('intelligence');
        },
      },
      {
        id: 'nav-documents',
        group: 'Navigate',
        label: 'Documents & Grounding',
        description: 'Ephemerally ingested PDFs and notes for grounded context',
        keywords: ['documents', 'rag', 'pdf', 'notes', 'citations', 'grounding'],
        icon: FileText,
        action: () => {
          onClose();
          onNavigate('documents');
        },
      },
      {
        id: 'nav-moments',
        group: 'Navigate',
        label: 'Vault Moments',
        description: 'Synthesized personal chapters and milestone narratives',
        keywords: ['moments', 'milestones', 'chapters', 'timeline', 'synthesis'],
        icon: Calendar,
        action: () => {
          onClose();
          onNavigate('moments');
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigate',
        label: 'Profile & Settings',
        description: 'Preferences, companion depth/tone, appearance, and UID info',
        keywords: ['profile', 'settings', 'preferences', 'appearance', 'theme', 'config'],
        icon: Settings,
        shortcut: ',',
        action: () => {
          onClose();
          onOpenSettings();
        },
      },

      // Preferences
      {
        id: 'pref-theme',
        group: 'Preferences',
        label: `Switch to ${currentTheme === 'morning' ? 'Night Vault' : 'Morning Vault'}`,
        description: `Toggle theme tokens (currently ${currentTheme})`,
        keywords: ['theme', 'dark', 'light', 'night', 'morning', 'appearance', 'color'],
        icon: currentTheme === 'morning' ? Moon : Sun,
        shortcut: 'T',
        action: () => {
          onClose();
          onToggleTheme();
        },
      },
    ];

    if (onToggleFocusMode) {
      list.push({
        id: 'pref-focus-mode',
        group: 'Preferences',
        label: isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode',
        description: 'Toggle distraction-free full-canvas writing experience',
        keywords: ['focus', 'zen', 'distraction', 'immersive', 'full screen'],
        icon: isFocusMode ? Minimize2 : Maximize2,
        shortcut: '⇧⌘F',
        action: () => {
          onClose();
          onToggleFocusMode();
        },
      });
    }

    return list;
  }, [
    currentTheme,
    isFocusMode,
    onClose,
    onNavigate,
    onStartNewReflection,
    onOpenNewMemory,
    onOpenAskVault,
    onExportVault,
    onOpenSettings,
    onToggleTheme,
    onToggleFocusMode,
  ]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.description.toLowerCase().includes(q)) return true;
      if (cmd.group.toLowerCase().includes(q)) return true;
      return cmd.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [commands, query]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus trap & hotkey handlers
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setSelectedIndex(0);

      // Focus input on next tick
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigationSourceRef.current = 'keyboard';
          setSelectedIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigationSourceRef.current = 'keyboard';
          setSelectedIndex((prev) =>
            filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0
          );
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          return;
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose, filteredCommands, selectedIndex]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Auto-scroll highlighted command into view ONLY when navigating via keyboard
  useEffect(() => {
    if (navigationSourceRef.current === 'keyboard' && listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)]/40">
          <Search className="w-4 h-4 text-[var(--gv-accent)] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filteredCommands.length > 0}
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              filteredCommands[selectedIndex] ? `cmd-item-${filteredCommands[selectedIndex].id}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, action, or destination..."
            className="flex-1 bg-transparent text-sm text-[var(--gv-text-primary)] placeholder-[var(--gv-text-tertiary)] outline-none border-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[var(--gv-text-muted)] ml-2 px-1.5 py-0.5 rounded border border-[var(--gv-border-subtle)]">
            ESC
          </span>
        </div>

        {/* Command List / Results */}
        <div
          ref={listRef}
          id="command-palette-listbox"
          role="listbox"
          className="max-h-80 overflow-y-auto p-2 divide-y divide-[var(--gv-border-subtle)]/40 overscroll-contain"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--gv-surface-raised)] text-[var(--gv-text-muted)] flex items-center justify-center mx-auto mb-2">
                <Search className="w-4 h-4" />
              </div>
              <div className="text-xs font-medium text-[var(--gv-text-secondary)]">No commands found</div>
              <div className="text-[11px] text-[var(--gv-text-tertiary)] mt-1">
                Try searching for <span className="font-mono text-[var(--gv-accent)]">reflect</span>,{' '}
                <span className="font-mono text-[var(--gv-accent)]">memory</span>,{' '}
                <span className="font-mono text-[var(--gv-accent)]">vault</span>, or{' '}
                <span className="font-mono text-[var(--gv-accent)]">export</span>.
              </div>
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const Icon = cmd.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  id={`cmd-item-${cmd.id}`}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => cmd.action()}
                  onMouseMove={() => {
                    navigationSourceRef.current = 'mouse';
                    if (selectedIndex !== index) {
                      setSelectedIndex(index);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-[var(--gv-accent-muted)]/70 text-[var(--gv-text-primary)] border border-[var(--gv-accent-border)]'
                      : 'hover:bg-[var(--gv-surface-raised)]/60 text-[var(--gv-text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg shrink-0 transition ${
                        isSelected
                          ? 'bg-[var(--gv-accent)] text-white'
                          : 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-secondary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--gv-text-primary)] truncate">{cmd.label}</span>
                        <span className="text-[9px] uppercase tracking-wider font-mono text-[var(--gv-text-muted)] px-1.5 py-0.2 rounded bg-[var(--gv-surface-base)] border border-[var(--gv-border-subtle)]">
                          {cmd.group}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--gv-text-tertiary)] truncate mt-0.5">{cmd.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    {cmd.shortcut && (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--gv-text-muted)] bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)]">
                        {cmd.shortcut}
                      </span>
                    )}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[var(--gv-accent)]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 border-t border-[var(--gv-border-subtle)] bg-[var(--gv-surface-raised)]/20 flex items-center justify-between text-[11px] text-[var(--gv-text-muted)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)]">
                ↑↓
              </span>{' '}
              Navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)]">
                ↵
              </span>{' '}
              Execute
            </span>
          </div>
          <span className="font-serif text-[10px] text-[var(--gv-text-tertiary)]">Gemini Vault Command Hub</span>
        </div>
      </div>
    </div>
  );
};
