/**
 * Gemini Vault — Data Sovereignty & Portability Utility
 * Handles authenticated export archive generation, deterministic naming,
 * Markdown synthesis, and browser download triggers.
 */

export interface VaultExportBundle {
  exportVersion: string;
  exportedAt: string;
  generator: string;
  user: {
    uid: string;
    email: string | null;
    displayName: string;
    preferences: Record<string, unknown>;
    accountCreatedAt: string | null;
  };
  summary: {
    memoriesCount: number;
    openLoopsCount: number;
    sessionsCount: number;
    momentsCount: number;
  };
  memories: Array<{
    id: string;
    fact: string;
    category: string;
    userNotes: string;
    importance: number;
    confidence: number;
    sourceType: string;
    sourceSessionId: string | null;
    sourceMessageId: string | null;
    sourceSnippet: string | null;
    sourceModality: string;
    evolutionStatus: string;
    supersedesMemoryId: string | null;
    supersededByMemoryId: string | null;
    memoryStatus: string;
    loopStatus: string | null;
    snoozedUntil: string | null;
    resolvedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    referenceCount: number;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    wordCount: number;
    clientStartedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    continuedFromSessionId: string | null;
    rootSessionId: string | null;
    locationContext: { mode: string; label: string } | null;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      clientTimestamp: string | null;
      timestamp: string | null;
      modality: 'text' | 'voice';
    }>;
  }>;
  moments: Array<{
    id: string;
    title: string;
    narrative: string;
    userNotes: string;
    occurredAt: string | null;
    createdAt: string | null;
    memoryIds: string[];
    reflectionIds: string[];
    commitmentIds: string[];
    documentIds: string[];
    locationContext: { mode: string; label: string } | null;
  }>;
}

/**
 * Deterministic filename generator: gemini-vault-export-[timestamp].[json|md]
 */
export function getExportFilename(format: 'json' | 'md', date: Date = new Date()): string {
  const iso = date.toISOString().replace(/[:.]/g, '-');
  return `gemini-vault-export-${iso}.${format}`;
}

/**
 * Synthesizes a human-readable Markdown archive from the structured export payload.
 */
export function convertExportToMarkdown(data: VaultExportBundle): string {
  const lines: string[] = [];

  lines.push('# Gemini Vault — Personal Export Archive');
  lines.push('');
  lines.push(`**Exported At:** ${data.exportedAt}`);
  lines.push(`**Account:** ${data.user.displayName} (${data.user.email || 'Private Account'})`);
  lines.push(`**User ID:** \`${data.user.uid}\``);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 1. Vault Summary');
  lines.push(`- **Saved Memories:** ${data.summary.memoriesCount}`);
  lines.push(`- **Open Loops & Commitments:** ${data.summary.openLoopsCount}`);
  lines.push(`- **Reflection Sessions:** ${data.summary.sessionsCount}`);
  lines.push(`- **Vault Moments:** ${data.summary.momentsCount}`);
  lines.push('');

  // 2. Memories
  lines.push('---');
  lines.push('');
  lines.push('## 2. Approved Memories & Insights');
  lines.push('');
  if (data.memories.length === 0) {
    lines.push('*No memories recorded.*');
    lines.push('');
  } else {
    data.memories.forEach((mem, index) => {
      const loopTag = mem.loopStatus ? ` [Loop: ${mem.loopStatus.toUpperCase()}]` : '';
      const evolutionTag = mem.evolutionStatus && mem.evolutionStatus !== 'active' ? ` [${mem.evolutionStatus}]` : '';
      lines.push(`### ${index + 1}. [${mem.category.toUpperCase()}] ${mem.fact}${loopTag}${evolutionTag}`);
      if (mem.userNotes) {
        lines.push(`> **Personal Note:** ${mem.userNotes}`);
      }
      lines.push(`- **Created:** ${mem.createdAt || 'Unknown'}`);
      lines.push(`- **Importance:** ${Math.round(mem.importance * 100)}% | **Confidence:** ${Math.round(mem.confidence * 100)}%`);
      lines.push(`- **Source Type:** ${mem.sourceType} (${mem.sourceModality})`);
      if (mem.sourceSnippet) {
        lines.push(`- **Verbatim Provenance:** "${mem.sourceSnippet}"`);
      }
      lines.push('');
    });
  }

  // 3. Vault Moments
  lines.push('---');
  lines.push('');
  lines.push('## 3. Vault Moments & Milestones');
  lines.push('');
  if (data.moments.length === 0) {
    lines.push('*No milestones synthesized yet.*');
    lines.push('');
  } else {
    data.moments.forEach((moment, index) => {
      lines.push(`### ${index + 1}. ${moment.title}`);
      lines.push(`*Occurred:* ${moment.occurredAt || moment.createdAt || 'N/A'}`);
      if (moment.locationContext) {
        lines.push(`*Location:* ${moment.locationContext.label}`);
      }
      lines.push('');
      lines.push(moment.narrative);
      lines.push('');
      if (moment.userNotes) {
        lines.push(`> **Note:** ${moment.userNotes}`);
        lines.push('');
      }
    });
  }

  // 4. Reflection Sessions
  lines.push('---');
  lines.push('');
  lines.push('## 4. Reflection Sessions');
  lines.push('');
  if (data.sessions.length === 0) {
    lines.push('*No reflections recorded.*');
    lines.push('');
  } else {
    data.sessions.forEach((session, sIdx) => {
      lines.push(`### Session ${sIdx + 1}: ${session.title} (${session.status})`);
      lines.push(`- **Started:** ${session.clientStartedAt || session.createdAt || 'N/A'}`);
      lines.push(`- **Word Count:** ~${session.wordCount} words`);
      if (session.locationContext) {
        lines.push(`- **Location:** ${session.locationContext.label}`);
      }
      lines.push('');

      if (session.messages.length === 0) {
        lines.push('*No message turns recorded for this reflection.*');
        lines.push('');
      } else {
        session.messages.forEach((msg) => {
          const speaker = msg.role === 'user' ? 'You' : 'Reflective Companion';
          lines.push(`**${speaker}** (${msg.modality}):`);
          lines.push(msg.content);
          lines.push('');
        });
      }
      lines.push('---');
      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Triggers a browser file download using standard Blob and object URL semantics.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Orchestrates an authenticated export download from the server.
 */
export async function executeVaultExport(
  getIdToken: () => Promise<string | null>,
  format: 'json' | 'md' = 'json'
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const token = await getIdToken();
    if (!token) {
      return { success: false, error: 'Authentication required to export your Vault.' };
    }

    const res = await fetch('/api/memories/export', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.message || 'Failed to generate personal Vault export archive.',
      };
    }

    const data = await res.json();
    const exportBundle: VaultExportBundle = data.export;

    if (!exportBundle) {
      return { success: false, error: 'Malformed export data received.' };
    }

    const filename = getExportFilename(format);

    if (format === 'json') {
      const jsonString = JSON.stringify(exportBundle, null, 2);
      triggerFileDownload(jsonString, filename, 'application/json;charset=utf-8');
    } else {
      const markdownString = convertExportToMarkdown(exportBundle);
      triggerFileDownload(markdownString, filename, 'text/markdown;charset=utf-8');
    }

    return { success: true, filename };
  } catch (err: unknown) {
    console.error('[VaultExport] Export error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred while preparing your export.',
    };
  }
}
