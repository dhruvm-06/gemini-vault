import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import { adminDb } from '../firebaseAdmin';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getGeminiClient, generateDocumentSummary, extractDocumentActions } from '../gemini';
import {
  VaultDocument,
  VaultDocumentChunk,
  DocumentUploadResponse,
  DocumentListResponse,
  DocumentDetailResponse,
  DocumentDeleteResponse,
  DocumentQueryResponse,
} from '../../src/types/documents';
import {
  MAX_FILE_SIZE_BYTES,
  validateFileBuffer,
  computeBufferChecksum,
  extractDocumentText,
  chunkExtractedPages,
  generateBatchEmbeddings,
  rankChunksForQuery,
  buildGroundedDocumentPrompt,
  validateAndFilterCitations,
} from '../documentEngine';

const router = Router();

// Configure Multer for strict in-memory storage (ephemeral processing, no disk persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// Middleware for Multer error handling (e.g. file size limit exceeded)
const handleUploadErrors = (err: any, req: any, res: Response, next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: `File exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      });
      return;
    }
    res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    return;
  }
  if (err) {
    res.status(500).json({ success: false, error: err.message || 'Internal upload error' });
    return;
  }
  next();
};

const querySchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question exceeds 1000 characters'),
  documentIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)).optional(),
});

/**
 * POST /api/documents/upload
 * Ephemeral ingestion pipeline:
 * upload -> validate -> extract -> chunk -> embed -> store metadata/chunks -> discard binary
 */
router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  handleUploadErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ success: false, error: 'No file uploaded in request' });
      return;
    }

    const file = req.file;

    // 1. Validate file buffer, extension, and magic bytes
    const validation = validateFileBuffer(file.buffer, file.originalname, file.mimetype);
    if (!validation.isValid) {
      const statusCode = validation.error?.includes('exceeds 10 MB')
        ? 413
        : validation.error?.includes('Unsupported file extension')
        ? 415
        : 400;
      res.status(statusCode).json({ success: false, error: validation.error });
      return;
    }

    const detectedMime = validation.detectedMime!;
    const sanitizedFilename = validation.sanitizedFilename;
    const checksum = computeBufferChecksum(file.buffer);

    try {
      // 2. Deduplication check: check if the exact same document was already uploaded by this user
      const existingQuery = await adminDb
        .collection('users')
        .doc(userId)
        .collection('documents')
        .where('checksum', '==', checksum)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0].data() as VaultDocument;
        if (existingDoc.status === 'ready') {
          res.status(200).json({
            success: true,
            document: existingDoc,
            duplicate: true,
          } as DocumentUploadResponse);
          return;
        }
      }

      // 3. Initialize document record with status: 'processing'
      const documentId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const initialDoc: VaultDocument = {
        id: documentId,
        userId,
        filename: sanitizedFilename,
        mimeType: detectedMime,
        sizeBytes: file.buffer.length,
        pageCount: null,
        chunkCount: 0,
        status: 'processing',
        checksum,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(documentId);
      await docRef.set(initialDoc);

      // 4. Extraction & Normalization
      let extractionResult: {
        pages: Array<{ pageNumber: number | null; text: string }>;
        pageCount: number | null;
      };

      try {
        extractionResult = await extractDocumentText(file.buffer, detectedMime);
      } catch (extractErr: any) {
        const errMsg = extractErr?.message || 'Failed to extract text from document';
        await docRef.update({
          status: 'failed',
          errorMessage: errMsg,
          updatedAt: new Date().toISOString(),
        });
        res.status(422).json({
          success: false,
          error: errMsg,
          document: { ...initialDoc, status: 'failed', errorMessage: errMsg },
        });
        return;
      }

      // 5. Recursive semantic chunking
      const unembChunks = chunkExtractedPages(
        documentId,
        userId,
        extractionResult.pages,
        nowIso
      );

      if (unembChunks.length === 0) {
        const errMsg = 'Document contains no chunkable text content.';
        await docRef.update({
          status: 'failed',
          errorMessage: errMsg,
          updatedAt: new Date().toISOString(),
        });
        res.status(422).json({
          success: false,
          error: errMsg,
          document: { ...initialDoc, status: 'failed', errorMessage: errMsg },
        });
        return;
      }

      // 6. Generate batch embeddings via Vertex AI text-embedding-005
      const geminiClient = getGeminiClient();
      let embeddings: number[][];
      try {
        embeddings = await generateBatchEmbeddings(
          geminiClient,
          unembChunks.map((c) => c.text),
          'RETRIEVAL_DOCUMENT'
        );
      } catch (embedErr: any) {
        const errMsg = `Embedding generation failed: ${embedErr?.message || 'Vertex AI error'}`;
        await docRef.update({
          status: 'failed',
          errorMessage: errMsg,
          updatedAt: new Date().toISOString(),
        });
        res.status(502).json({
          success: false,
          error: errMsg,
          document: { ...initialDoc, status: 'failed', errorMessage: errMsg },
        });
        return;
      }

      // 7. Write chunks to Firestore (using atomic 400-op batches)
      const chunksCollection = docRef.collection('chunks');
      const BATCH_LIMIT = 400;

      for (let i = 0; i < unembChunks.length; i += BATCH_LIMIT) {
        const slice = unembChunks.slice(i, i + BATCH_LIMIT);
        const batch = adminDb.batch();

        for (let j = 0; j < slice.length; j++) {
          const chunkData: VaultDocumentChunk = {
            ...slice[j],
            embedding: embeddings[i + j],
          };
          const chunkRef = chunksCollection.doc(chunkData.id);
          batch.set(chunkRef, chunkData);
        }

        await batch.commit();
      }

      // 8. Update parent document to status: 'ready'
      const finalDoc: VaultDocument = {
        ...initialDoc,
        status: 'ready',
        chunkCount: unembChunks.length,
        pageCount: extractionResult.pageCount,
        updatedAt: new Date().toISOString(),
      };

      await docRef.set(finalDoc);

      res.status(200).json({
        success: true,
        document: finalDoc,
      } as DocumentUploadResponse);
    } catch (err: any) {
      console.error('[Document Upload Error]:', err);
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred during document ingestion.',
      });
    }
  }
);

/**
 * GET /api/documents
 * Lists documents for authenticated user
 */
router.get(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;

    try {
      const snap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('documents')
        .orderBy('createdAt', 'desc')
        .get();

      const documents: VaultDocument[] = snap.docs.map((doc) => doc.data() as VaultDocument);

      res.status(200).json({
        success: true,
        documents,
      } as DocumentListResponse);
    } catch (err: any) {
      console.error('[Document List Error]:', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve documents.' });
    }
  }
);

/**
 * GET /api/documents/:id
 * Retrieve a specific document for the authenticated user
 */
router.get(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const docSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('documents')
        .doc(documentId)
        .get();

      if (!docSnap.exists) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      const document = docSnap.data() as VaultDocument;
      res.status(200).json({
        success: true,
        document,
        chunkCount: document.chunkCount,
      } as DocumentDetailResponse);
    } catch (err: any) {
      console.error('[Document Detail Error]:', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve document.' });
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Cascading delete: removes document metadata and all associated chunk subcollections
 */
router.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const docRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('documents')
        .doc(documentId);

      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      // Fetch all child chunks
      const chunksSnap = await docRef.collection('chunks').get();
      let deletedChunksCount = 0;

      if (!chunksSnap.empty) {
        const BATCH_LIMIT = 400;
        for (let i = 0; i < chunksSnap.docs.length; i += BATCH_LIMIT) {
          const slice = chunksSnap.docs.slice(i, i + BATCH_LIMIT);
          const batch = adminDb.batch();
          for (const chunkDoc of slice) {
            batch.delete(chunkDoc.ref);
            deletedChunksCount++;
          }
          await batch.commit();
        }
      }

      // Delete parent document
      await docRef.delete();

      res.status(200).json({
        success: true,
        documentId,
        deletedChunksCount,
      } as DocumentDeleteResponse);
    } catch (err: any) {
      console.error('[Document Delete Error]:', err);
      res.status(500).json({ success: false, error: 'Failed to delete document.' });
    }
  }
);

/**
 * POST /api/documents/query
 * Grounded query synthesis over authenticated user's documents
 */
router.post(
  '/query',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const startTime = Date.now();

    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.issues?.[0]?.message || 'Invalid query format',
      });
      return;
    }

    const { question, documentIds } = parseResult.data;

    try {
      // 1. Fetch ready documents
      const tReadStart = Date.now();
      let docsQuery = adminDb
        .collection('users')
        .doc(userId)
        .collection('documents')
        .where('status', '==', 'ready');

      const docsSnap = await docsQuery.get();
      let readyDocs = docsSnap.docs.map((d) => d.data() as VaultDocument);

      // Filter by documentIds if specified
      if (documentIds && documentIds.length > 0) {
        const allowedSet = new Set(documentIds);
        readyDocs = readyDocs.filter((d) => allowedSet.has(d.id));
      }

      if (readyDocs.length === 0) {
        res.status(200).json({
          success: true,
          answer: "I don't have any ready documents in your Vault to answer that question.",
          groundingSummary: 'No ready documents',
          insufficientEvidence: true,
          citations: [],
          metrics: {
            firestoreReadMs: Date.now() - tReadStart,
            embeddingMs: 0,
            rankingMs: 0,
            generationMs: 0,
            totalMs: Date.now() - startTime,
          },
        } as DocumentQueryResponse);
        return;
      }

      const docsMap = new Map<string, VaultDocument>();
      for (const d of readyDocs) {
        docsMap.set(d.id, d);
      }

      // Fetch all chunks for eligible documents
      const chunkPromises = readyDocs.map((d) =>
        adminDb
          .collection('users')
          .doc(userId)
          .collection('documents')
          .doc(d.id)
          .collection('chunks')
          .get()
      );

      const chunkSnaps = await Promise.all(chunkPromises);
      const allChunks: VaultDocumentChunk[] = [];
      for (const snap of chunkSnaps) {
        for (const chunkDoc of snap.docs) {
          allChunks.push(chunkDoc.data() as VaultDocumentChunk);
        }
      }

      const firestoreReadMs = Date.now() - tReadStart;

      if (allChunks.length === 0) {
        res.status(200).json({
          success: true,
          answer: "I don't have enough evidence in your uploaded documents to answer that question confidently.",
          groundingSummary: 'Limited document evidence',
          insufficientEvidence: true,
          citations: [],
          metrics: {
            firestoreReadMs,
            embeddingMs: 0,
            rankingMs: 0,
            generationMs: 0,
            totalMs: Date.now() - startTime,
          },
        } as DocumentQueryResponse);
        return;
      }

      // 2. Generate query embedding with taskType: 'RETRIEVAL_QUERY'
      const tEmbStart = Date.now();
      const geminiClient = getGeminiClient();
      const queryEmbeddings = await generateBatchEmbeddings(
        geminiClient,
        [question],
        'RETRIEVAL_QUERY'
      );
      const queryVector = queryEmbeddings[0];
      const embeddingMs = Date.now() - tEmbStart;

      // 3. Hybrid ranking (0.70 cosine + 0.25 lexical + 0.05 recency)
      const tRankStart = Date.now();
      const rankedChunks = rankChunksForQuery(
        allChunks,
        question,
        queryVector,
        docsMap,
        { maxChunks: 6 }
      );
      const rankingMs = Date.now() - tRankStart;

      // If no chunks meet similarity threshold, return calm insufficiency statement without calling LLM
      if (rankedChunks.length === 0) {
        res.status(200).json({
          success: true,
          answer: "I don't have enough evidence in your uploaded documents to answer that question confidently.",
          groundingSummary: 'Limited document evidence',
          insufficientEvidence: true,
          citations: [],
          metrics: {
            firestoreReadMs,
            embeddingMs,
            rankingMs,
            generationMs: 0,
            totalMs: Date.now() - startTime,
          },
        } as DocumentQueryResponse);
        return;
      }

      // 4. Grounded synthesis via Gemini
      const tGenStart = Date.now();
      const { systemPrompt, userPrompt } = buildGroundedDocumentPrompt(question, rankedChunks);

      let rawAnswer = '';
      try {
        const response: any = await geminiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2,
          },
        });
        rawAnswer = response.text || '';
      } catch (genErr) {
        // Fallback to gemini-3.5-flash-lite
        try {
          const fallbackRes: any = await geminiClient.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.2,
            },
          });
          rawAnswer = fallbackRes.text || '';
        } catch (fallbackErr: any) {
          throw new Error(`Gemini synthesis failed on both models: ${fallbackErr?.message}`);
        }
      }

      const generationMs = Date.now() - tGenStart;

      // 5. Post-generation citation validation & formatting
      const { validatedCitations, cleanedAnswer, insufficientEvidence, groundingSummary } =
        validateAndFilterCitations(rawAnswer, rankedChunks, docsMap);

      res.status(200).json({
        success: true,
        answer: cleanedAnswer,
        groundingSummary,
        insufficientEvidence,
        citations: validatedCitations,
        metrics: {
          firestoreReadMs,
          embeddingMs,
          rankingMs,
          generationMs,
          totalMs: Date.now() - startTime,
        },
      } as DocumentQueryResponse);
    } catch (err: any) {
      console.error('[Document Query Error]:', err);
      res.status(500).json({
        success: false,
        error: 'An error occurred while answering your question from documents.',
      });
    }
  }
);

/**
 * POST /api/documents/:id/summarize
 * Grounded on-demand summary of an uploaded document using its indexed chunks.
 */
router.post(
  '/:id/summarize',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!documentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(documentId)) {
        res.status(400).json({ success: false, error: 'Invalid document ID format.' });
        return;
      }

      // Verify ownership
      const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(documentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        res.status(404).json({ success: false, error: 'Document not found or unauthorized.' });
        return;
      }

      const docData = docSnap.data() as VaultDocument;

      // Fetch chunks belonging to this document
      const chunksSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('chunks')
        .where('documentId', '==', documentId)
        .orderBy('chunkIndex', 'asc')
        .limit(20)
        .get();

      const chunks = chunksSnap.docs.map((d) => d.data() as VaultDocumentChunk);
      if (chunks.length === 0) {
        res.status(400).json({ success: false, error: 'Document has no indexed text chunks.' });
        return;
      }

      const summaryResult = await generateDocumentSummary(docData.filename, chunks);

      res.json({
        success: true,
        documentId,
        filename: docData.filename,
        summary: summaryResult.summary,
        keyTakeaways: summaryResult.keyTakeaways,
      });
    } catch (err: any) {
      console.error('[Document Summarize Error]:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to generate document summary.',
      });
    }
  }
);

/**
 * POST /api/documents/:id/extract-actions
 * Extracts actionable suggestions from an uploaded document.
 */
router.post(
  '/:id/extract-actions',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!documentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(documentId)) {
        res.status(400).json({ success: false, error: 'Invalid document ID format.' });
        return;
      }

      const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(documentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        res.status(404).json({ success: false, error: 'Document not found or unauthorized.' });
        return;
      }

      const docData = docSnap.data() as VaultDocument;

      const chunksSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('chunks')
        .where('documentId', '==', documentId)
        .orderBy('chunkIndex', 'asc')
        .limit(20)
        .get();

      const chunks = chunksSnap.docs.map((d) => d.data() as VaultDocumentChunk);
      if (chunks.length === 0) {
        res.json({ success: true, documentId, actions: [] });
        return;
      }

      const extracted = await extractDocumentActions(docData.filename, chunks);

      const actions = extracted.map((act) => ({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'commitment',
        title: act.title,
        description: act.description,
        sourceEvidence: act.sourceEvidence,
        confidence: 0.85,
        status: 'suggested',
      }));

      res.json({
        success: true,
        documentId,
        filename: docData.filename,
        actions,
      });
    } catch (err: any) {
      console.error('[Document Extract Actions Error]:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to extract document actions.',
      });
    }
  }
);

export default router;
