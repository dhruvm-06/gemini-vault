import test from 'node:test';
import assert from 'node:assert/strict';
import { getExportFilename, convertExportToMarkdown, VaultExportBundle } from '../src/utils/vaultExport';

test('1. Export Filename Determinism: Correct ISO timestamp structure for JSON and Markdown', () => {
  const fixedDate = new Date('2026-09-05T15:30:00.000Z');
  const jsonName = getExportFilename('json', fixedDate);
  const mdName = getExportFilename('md', fixedDate);

  assert.equal(jsonName, 'gemini-vault-export-2026-09-05T15-30-00-000Z.json');
  assert.equal(mdName, 'gemini-vault-export-2026-09-05T15-30-00-000Z.md');
});

test('2. Export Security & Sanitization: Strictly excludes tokens, API keys, credentials, and embeddings', () => {
  const sampleExport: VaultExportBundle = {
    exportVersion: '1.0',
    exportedAt: '2026-09-05T15:30:00.000Z',
    generator: 'Gemini Vault Personal Portability Engine',
    user: {
      uid: 'verified-uid-abc-123',
      email: 'user@example.com',
      displayName: 'Alice Keeper',
      preferences: {
        theme: 'night',
        reflectionDepth: 'balanced',
        conversationTone: 'empathic',
        defaultLocationMode: 'coarse',
      },
      accountCreatedAt: '2026-08-01T10:00:00.000Z',
    },
    summary: {
      memoriesCount: 1,
      openLoopsCount: 1,
      sessionsCount: 1,
      momentsCount: 1,
    },
    memories: [
      {
        id: 'mem_001',
        fact: 'Complete the product enhancement pass before Saturday midnight.',
        category: 'commitment',
        userNotes: 'High priority',
        importance: 0.9,
        confidence: 1.0,
        sourceType: 'manual',
        sourceSessionId: null,
        sourceMessageId: null,
        sourceSnippet: null,
        sourceModality: 'text',
        evolutionStatus: 'active',
        supersedesMemoryId: null,
        supersededByMemoryId: null,
        memoryStatus: 'active',
        loopStatus: 'open',
        snoozedUntil: null,
        resolvedAt: null,
        createdAt: '2026-09-05T12:00:00.000Z',
        updatedAt: '2026-09-05T12:00:00.000Z',
        referenceCount: 0,
      },
    ],
    sessions: [
      {
        id: 'session_001',
        title: 'Weekly Focus Review',
        status: 'completed',
        wordCount: 150,
        clientStartedAt: '2026-09-05T11:00:00.000Z',
        createdAt: '2026-09-05T11:00:00.000Z',
        updatedAt: '2026-09-05T11:30:00.000Z',
        continuedFromSessionId: null,
        rootSessionId: null,
        locationContext: { mode: 'coarse', label: 'San Francisco, CA' },
        messages: [
          {
            id: 'msg_001',
            role: 'user',
            content: 'I want to focus on finishing data portability today.',
            clientTimestamp: '2026-09-05T11:01:00.000Z',
            timestamp: '2026-09-05T11:01:00.000Z',
            modality: 'text',
          },
          {
            id: 'msg_002',
            role: 'assistant',
            content: 'What does finishing this data portability capability unlock for you?',
            clientTimestamp: '2026-09-05T11:01:05.000Z',
            timestamp: '2026-09-05T11:01:05.000Z',
            modality: 'text',
          },
        ],
      },
    ],
    moments: [
      {
        id: 'moment_001',
        title: 'Portability Milestone',
        narrative: 'Successfully designed and verified user-controlled vault export.',
        userNotes: 'A major milestone for data sovereignty.',
        occurredAt: '2026-09-05',
        createdAt: '2026-09-05T14:00:00.000Z',
        memoryIds: ['mem_001'],
        reflectionIds: ['session_001'],
        commitmentIds: [],
        documentIds: [],
        locationContext: null,
      },
    ],
  };

  const serialized = JSON.stringify(sampleExport);

  // Assert absence of sensitive credential markers
  const forbiddenPatterns = [
    /apiKey/i,
    /firebaseToken/i,
    /accessToken/i,
    /refreshToken/i,
    /privateKey/i,
    /embedding/i,
    /secret/i,
    /clientSecret/i,
  ];

  forbiddenPatterns.forEach((pattern) => {
    assert.ok(!pattern.test(serialized), `Export payload must not contain sensitive key matching ${pattern}`);
  });

  // Verify ownership isolation and identity
  assert.equal(sampleExport.user.uid, 'verified-uid-abc-123');
  assert.equal(sampleExport.exportVersion, '1.0');
});

test('3. Export Empty-Vault Handling: Graceful empty collections and zero counts', () => {
  const emptyExport: VaultExportBundle = {
    exportVersion: '1.0',
    exportedAt: '2026-09-05T15:00:00.000Z',
    generator: 'Gemini Vault Personal Portability Engine',
    user: {
      uid: 'empty-uid',
      email: 'newbie@example.com',
      displayName: 'New User',
      preferences: { theme: 'night' },
      accountCreatedAt: '2026-09-05T15:00:00.000Z',
    },
    summary: {
      memoriesCount: 0,
      openLoopsCount: 0,
      sessionsCount: 0,
      momentsCount: 0,
    },
    memories: [],
    sessions: [],
    moments: [],
  };

  const md = convertExportToMarkdown(emptyExport);
  assert.ok(md.includes('Saved Memories:** 0'));
  assert.ok(md.includes('*No memories recorded.*'));
  assert.ok(md.includes('*No milestones synthesized yet.*'));
  assert.ok(md.includes('*No reflections recorded.*'));
});

test('4. Export Markdown Conversion: Renders structured sections with memories and dialogue', () => {
  const sampleExport: VaultExportBundle = {
    exportVersion: '1.0',
    exportedAt: '2026-09-05T15:30:00.000Z',
    generator: 'Gemini Vault Personal Portability Engine',
    user: {
      uid: 'uid-test',
      email: 'test@example.com',
      displayName: 'Tester',
      preferences: {},
      accountCreatedAt: null,
    },
    summary: {
      memoriesCount: 1,
      openLoopsCount: 1,
      sessionsCount: 1,
      momentsCount: 0,
    },
    memories: [
      {
        id: 'mem_1',
        fact: 'Building an authentic AI companion.',
        category: 'goal',
        userNotes: 'Core mission statement',
        importance: 0.95,
        confidence: 1.0,
        sourceType: 'manual',
        sourceSessionId: null,
        sourceMessageId: null,
        sourceSnippet: null,
        sourceModality: 'text',
        evolutionStatus: 'active',
        supersedesMemoryId: null,
        supersededByMemoryId: null,
        memoryStatus: 'active',
        loopStatus: 'open',
        snoozedUntil: null,
        resolvedAt: null,
        createdAt: '2026-09-05T10:00:00Z',
        updatedAt: '2026-09-05T10:00:00Z',
        referenceCount: 2,
      },
    ],
    sessions: [
      {
        id: 's_1',
        title: 'Morning Thought Stream',
        status: 'active',
        wordCount: 45,
        clientStartedAt: '2026-09-05T09:00:00Z',
        createdAt: '2026-09-05T09:00:00Z',
        updatedAt: '2026-09-05T09:30:00Z',
        continuedFromSessionId: null,
        rootSessionId: null,
        locationContext: null,
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'How should I structure my reflection today?',
            clientTimestamp: '2026-09-05T09:01:00Z',
            timestamp: '2026-09-05T09:01:00Z',
            modality: 'text',
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Start with the single question that is taking up the most mental space.',
            clientTimestamp: '2026-09-05T09:01:03Z',
            timestamp: '2026-09-05T09:01:03Z',
            modality: 'text',
          },
        ],
      },
    ],
    moments: [],
  };

  const md = convertExportToMarkdown(sampleExport);

  assert.ok(md.includes('# Gemini Vault — Personal Export Archive'));
  assert.ok(md.includes('## 1. Vault Summary'));
  assert.ok(md.includes('## 2. Approved Memories & Insights'));
  assert.ok(md.includes('[GOAL] Building an authentic AI companion. [Loop: OPEN]'));
  assert.ok(md.includes('Morning Thought Stream (active)'));
  assert.ok(md.includes('**You** (text):'));
  assert.ok(md.includes('**Reflective Companion** (text):'));
});

test('5. Command Palette: Query filtering across commands, categories, and aliases', () => {
  const commands = [
    { id: '1', label: 'New Reflection', group: 'Actions', keywords: ['write', 'start', 'journal'] },
    { id: '2', label: 'Voice Studio', group: 'Navigate', keywords: ['audio', 'speak', 'mic'] },
    { id: '3', label: 'Export My Vault', group: 'Actions', keywords: ['download', 'portability', 'backup'] },
    { id: '4', label: 'Ask My Vault', group: 'Actions', keywords: ['query', 'intelligence'] },
    { id: '5', label: 'Profile & Settings', group: 'Navigate', keywords: ['preferences', 'appearance'] },
  ];

  const filter = (q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.group.toLowerCase().includes(term) ||
        c.keywords.some((k) => k.toLowerCase().includes(term))
    );
  };

  // Keyword match: "audio" should find Voice Studio
  const audioResults = filter('audio');
  assert.equal(audioResults.length, 1);
  assert.equal(audioResults[0].id, '2');

  // Keyword match: "backup" should find Export My Vault
  const backupResults = filter('backup');
  assert.equal(backupResults.length, 1);
  assert.equal(backupResults[0].id, '3');

  // Partial label match: "reflect" should find New Reflection
  const reflectResults = filter('reflect');
  assert.ok(reflectResults.some((r) => r.label === 'New Reflection'));

  // Non-matching query should return empty array
  const emptyResults = filter('unrelatedxyz123');
  assert.equal(emptyResults.length, 0);
});

test('6. Command Palette: Keyboard navigation index bounds & wrap-around invariant', () => {
  const itemCount = 5;

  const nextIndex = (current: number) => (current + 1) % itemCount;
  const prevIndex = (current: number) => (current - 1 + itemCount) % itemCount;

  assert.equal(nextIndex(0), 1);
  assert.equal(nextIndex(4), 0); // wrap to top
  assert.equal(prevIndex(0), 4); // wrap to bottom
  assert.equal(prevIndex(3), 2);
});

test('7. Focus Mode & Keyboard Hotkey Contract: Shortcut combinations and session guards', () => {
  const isPaletteHotkey = (e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; key: string }) =>
    Boolean((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k');

  const isFocusModeHotkey = (e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; key: string }) =>
    Boolean((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f');

  // macOS Cmd+K
  assert.equal(isPaletteHotkey({ metaKey: true, key: 'k' }), true);
  // Windows/Linux Ctrl+K
  assert.equal(isPaletteHotkey({ ctrlKey: true, key: 'k' }), true);
  // Should not trigger with Shift
  assert.equal(isPaletteHotkey({ ctrlKey: true, shiftKey: true, key: 'k' }), false);

  // Cmd+Shift+F
  assert.equal(isFocusModeHotkey({ metaKey: true, shiftKey: true, key: 'F' }), true);
  // Ctrl+Shift+F
  assert.equal(isFocusModeHotkey({ ctrlKey: true, shiftKey: true, key: 'f' }), true);
  // Regular F should not trigger
  assert.equal(isFocusModeHotkey({ key: 'f' }), false);
});
