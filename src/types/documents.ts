/**
 * Document Intelligence & RAG Data Contracts
 * Strict server-owned identity, verified UID scoping, and authoritative provenance.
 */

export type DocumentIngestionStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export type SupportedDocumentMimeType =
  | 'application/pdf'
  | 'text/plain'
  | 'text/markdown';

export interface VaultDocument {
  id: string;                      // Server-generated UUID
  userId: string;                  // Verified Firebase UID (never client-supplied)
  filename: string;                // Sanitized original filename (display only)
  mimeType: SupportedDocumentMimeType;
  sizeBytes: number;               // File size in bytes (max 10MB)
  pageCount: number | null;        // Integer for PDF, null for TXT/Markdown
  chunkCount: number;              // Number of indexed chunks
  status: DocumentIngestionStatus; // Pipeline lifecycle state
  checksum: string;                // SHA-256 hex digest for deduplication & integrity
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
  errorMessage?: string;           // Sanitized error message if status === 'failed'
}

export interface VaultDocumentChunk {
  id: string;                      // `${documentId}_c${zeroPaddedIndex}`
  documentId: string;              // Parent document UUID
  userId: string;                  // Verified Firebase UID
  chunkIndex: number;              // 0-indexed sequence in document
  pageNumber: number | null;       // 1-indexed page number if deterministically extracted, else null
  text: string;                    // Normalized chunk text (450-600 tokens)
  tokenCount: number;              // Estimated token count
  embedding: number[];             // 768-dimensional float vector from text-embedding-005
  createdAt: string;               // ISO 8601 timestamp
}

export interface DocumentCitation {
  documentId: string;
  filename: string;
  pageNumber: number | null;
  chunkId: string;
  sourceExcerpt: string;
}

export interface DocumentUploadResponse {
  success: boolean;
  document: VaultDocument;
  duplicate?: boolean;
}

export interface DocumentListResponse {
  success: boolean;
  documents: VaultDocument[];
}

export interface DocumentDetailResponse {
  success: boolean;
  document: VaultDocument;
  chunkCount?: number;
}

export interface DocumentDeleteResponse {
  success: boolean;
  documentId: string;
  deletedChunksCount: number;
}

export interface DocumentQueryRequest {
  question: string;
  documentIds?: string[];
}

export interface DocumentQueryResponse {
  success: boolean;
  answer: string;
  groundingSummary: string;
  insufficientEvidence: boolean;
  citations: DocumentCitation[];
  metrics?: {
    firestoreReadMs: number;
    embeddingMs: number;
    rankingMs: number;
    generationMs: number;
    totalMs: number;
  };
}
