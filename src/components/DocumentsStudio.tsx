import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCode,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  VaultDocument,
  DocumentCitation,
  DocumentQueryResponse,
} from '../types/documents';
import { FormattedResponse } from './FormattedResponse';

interface DocumentsStudioProps {
  onNavigate?: (view: any) => void;
}

export const DocumentsStudio: React.FC<DocumentsStudioProps> = () => {
  const { getIdToken } = useAuth();

  // Documents state
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query state
  const [question, setQuestion] = useState<string>('');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<DocumentQueryResponse | null>(null);

  // Evidence Drawer state
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<DocumentCitation | null>(null);

  // Load documents
  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle File Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadStatusText(`Uploading ${file.name}...`);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('file', file);

      setUploadStatusText(`Extracting & indexing ${file.name}...`);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to upload and index document.');
      }

      await fetchDocuments();
      if (result.duplicate) {
        setUploadStatusText(`Loaded existing copy of ${result.document.filename}`);
      } else {
        setUploadStatusText('');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Document Delete
  const handleDeleteDocument = async (docId: string, filename: string) => {
    if (!window.confirm(`Delete "${filename}" and all its extracted passages from your Vault?`)) {
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (selectedDocId === docId) {
          setSelectedDocId(null);
        }
        if (queryResult) {
          setQueryResult(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Handle Query Submission
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isQuerying) return;

    setIsQuerying(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      const payload: { question: string; documentIds?: string[] } = {
        question: question.trim(),
      };
      if (selectedDocId) {
        payload.documentIds = [selectedDocId];
      }

      const res = await fetch('/api/documents/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Query failed');
      }

      setQueryResult(data as DocumentQueryResponse);
      if (data.citations && data.citations.length > 0) {
        setShowEvidence(true);
      }
    } catch (err: any) {
      console.error('Query error:', err);
      setQueryError(err.message || 'Failed to synthesize document answer');
    } finally {
      setIsQuerying(false);
    }
  };

  const readyDocuments = documents.filter((d) => d.status === 'ready');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--gv-border-subtle)] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--gv-accent-gold)] px-2.5 py-1 rounded-full bg-[var(--gv-accent-gold)]/10 border border-[var(--gv-accent-gold)]/30">
            Source Grounding
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl text-[var(--gv-text-primary)] mt-3 font-medium">
            Documents Vault
          </h1>
          <p className="mt-1 text-sm text-[var(--gv-text-secondary)]">
            Ingest personal notes, essays, and PDFs for strictly grounded semantic retrieval.
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-[var(--gv-text-primary)] text-xs font-medium hover:border-[var(--gv-accent-gold)]/50 hover:bg-[var(--gv-surface-raised)]/90 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--gv-accent-gold)]" />
            ) : (
              <Upload className="w-4 h-4 text-[var(--gv-accent-gold)]" />
            )}
            <span>{isUploading ? 'Processing...' : 'Upload Document'}</span>
          </button>
        </div>
      </div>

      {/* Upload Status / Error Notification */}
      {uploadStatusText && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-accent-gold)]/30 text-xs text-[var(--gv-text-primary)] flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--gv-accent-gold)] flex-shrink-0" />
          <span>{uploadStatusText}</span>
        </div>
      )}

      {uploadError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Documents Library */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--gv-text-secondary)] px-1">
            <span className="uppercase tracking-wider">Library ({documents.length})</span>
            {selectedDocId && (
              <button
                type="button"
                onClick={() => setSelectedDocId(null)}
                className="text-[var(--gv-accent-gold)] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {loadingDocs ? (
            <div className="p-8 text-center text-xs text-[var(--gv-text-muted)] border border-dashed border-[var(--gv-border-subtle)] rounded-xl">
              Loading library...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-[var(--gv-border-subtle)] rounded-xl bg-[var(--gv-surface-raised)]/40">
              <FileText className="w-8 h-8 text-[var(--gv-text-muted)] mx-auto mb-3 opacity-60" />
              <p className="text-xs font-medium text-[var(--gv-text-primary)]">No documents yet</p>
              <p className="text-[11px] text-[var(--gv-text-secondary)] mt-1">
                Upload a .pdf, .md, or .txt file to ground your reflections.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isReady = doc.status === 'ready';
                const isFailed = doc.status === 'failed';

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                    className={`group relative p-3 rounded-xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[var(--gv-accent-muted)] border-[var(--gv-accent-gold)]'
                        : 'bg-[var(--gv-surface-raised)] border-[var(--gv-border-subtle)] hover:border-[var(--gv-border-strong)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.mimeType === 'application/pdf' ? (
                          <BookOpen className="w-4 h-4 text-rose-500/80 flex-shrink-0" />
                        ) : doc.mimeType === 'text/markdown' ? (
                          <FileCode className="w-4 h-4 text-sky-500/80 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-emerald-500/80 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium text-[var(--gv-text-primary)] truncate">
                          {doc.filename}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id, doc.filename);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--gv-text-muted)] hover:text-red-500 transition"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--gv-text-secondary)]">
                      {isReady && (
                        <>
                          <span>{doc.chunkCount} passages</span>
                          {doc.pageCount && <span>• {doc.pageCount} pages</span>}
                        </>
                      )}
                      {isFailed && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Ingestion Failed
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="text-[var(--gv-accent-gold)] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </span>
                      )}
                    </div>

                    {isFailed && doc.errorMessage && (
                      <p className="mt-1 text-[10px] text-red-400 line-clamp-2">
                        {doc.errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Query & Grounded Synthesis */}
        <div className="md:col-span-2 space-y-6">
          {/* Query Form */}
          <div className="p-5 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] shadow-xs">
            <form onSubmit={handleQuery}>
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-medium text-[var(--gv-text-primary)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                  Grounded Document Query
                </span>
                <span className="text-[11px] text-[var(--gv-text-secondary)]">
                  {selectedDocId
                    ? `Searching: ${documents.find((d) => d.id === selectedDocId)?.filename}`
                    : `Searching all ${readyDocuments.length} ready documents`}
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void handleQuery(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder={
                    readyDocuments.length === 0
                      ? 'Upload a document above to query your personal archive...'
                      : 'Ask a question grounded strictly in your uploaded documents... (Enter to ask, Shift+Enter for newline)'
                  }
                  rows={3}
                  disabled={readyDocuments.length === 0 || isQuerying}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent-gold)] resize-none transition"
                  aria-label="Document question input"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-[var(--gv-text-secondary)]">
                  Grounds strictly against passages in ready documents.
                </span>

                <button
                  type="submit"
                  disabled={!question.trim() || readyDocuments.length === 0 || isQuerying}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gv-accent)] hover:bg-[var(--gv-accent-hover)] text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
                  aria-label={isQuerying ? 'Synthesizing answer from documents' : 'Ask documents'}
                >
                  {isQuerying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Ask</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {queryError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{queryError}</span>
              </div>
            )}
          </div>

          {/* Query Result Card */}
          {queryResult && (
            <div className="p-6 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--gv-border-subtle)]">
                <span className="text-xs font-medium text-[var(--gv-accent-gold)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {queryResult.groundingSummary}
                </span>

                {queryResult.citations && queryResult.citations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEvidence(!showEvidence)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{showEvidence ? 'Hide Evidence' : 'Inspect Evidence'}</span>
                    {showEvidence ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Polished Editorial Answer with Safe Markdown Rendering */}
              <div className="font-serif text-[15px] leading-relaxed text-[var(--gv-text-primary)]">
                <FormattedResponse content={queryResult.answer} />
              </div>

              {/* Latency Breakdown Metrics */}
              {queryResult.metrics && (
                <div className="pt-2 text-[10px] text-[var(--gv-text-secondary)] flex flex-wrap gap-3 border-t border-[var(--gv-border-subtle)] opacity-75">
                  <span>Read: {queryResult.metrics.firestoreReadMs}ms</span>
                  <span>Embed: {queryResult.metrics.embeddingMs}ms</span>
                  <span>Rank: {queryResult.metrics.rankingMs}ms</span>
                  <span>Synthesis: {queryResult.metrics.generationMs}ms</span>
                  <span>Total: {queryResult.metrics.totalMs}ms</span>
                </div>
              )}

              {/* Collapsible Evidence Drawer */}
              {showEvidence && queryResult.citations && queryResult.citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--gv-border-subtle)] space-y-3">
                  <span className="text-xs font-medium text-[var(--gv-text-primary)]">
                    Authoritative Citations ({queryResult.citations.length})
                  </span>

                  <div className="space-y-2">
                    {queryResult.citations.map((cite, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveCitation(cite)}
                        className="p-3 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] text-left hover:border-[var(--gv-accent-gold)]/40 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-xs text-[var(--gv-text-primary)] font-medium">
                          <span>{cite.filename}</span>
                          {cite.pageNumber !== null && (
                            <span className="text-[10px] text-[var(--gv-accent-gold)] px-2 py-0.5 rounded-full bg-[var(--gv-accent-gold)]/10">
                              Page {cite.pageNumber}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--gv-text-secondary)] italic leading-relaxed">
                          "{cite.sourceExcerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for full citation excerpt view */}
      {activeCitation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--gv-accent-gold)] uppercase tracking-wider">
                Source Passage
              </span>
              <button
                type="button"
                onClick={() => setActiveCitation(null)}
                className="text-[var(--gv-text-muted)] hover:text-[var(--gv-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="font-serif text-lg text-[var(--gv-text-primary)] font-medium">
                {activeCitation.filename}
              </h3>
              {activeCitation.pageNumber !== null && (
                <p className="text-xs text-[var(--gv-text-secondary)]">
                  Page {activeCitation.pageNumber}
                </p>
              )}
            </div>
            <div className="p-4 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] text-xs text-[var(--gv-text-primary)] leading-relaxed whitespace-pre-wrap">
              {activeCitation.sourceExcerpt}
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setActiveCitation(null)}
                className="px-4 py-2 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-xs text-[var(--gv-text-primary)] font-medium hover:bg-[var(--gv-surface-ground)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
