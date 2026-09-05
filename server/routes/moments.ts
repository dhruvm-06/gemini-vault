import { Router, Response } from 'express';
import { z } from 'zod';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { momentsRateLimiter } from '../middleware/rateLimit';
import { synthesizeMomentNarrativeWithFallback } from '../gemini';

const router = Router();

export const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const locationContextSchema = z.object({
  mode: z.enum(['coarse', 'precise']),
  label: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capturedAt: z.string().optional().default(() => new Date().toISOString()),
});

const createMomentSchema = z
  .object({
    title: z.string().max(200).optional(),
    narrative: z.string().max(4000).optional(),
    userNotes: z.string().max(2000).optional(),
    occurredAt: z.string().optional(),
    memoryIds: z.array(z.string().regex(SAFE_ID_REGEX, 'Invalid memory ID format')).max(20).optional().default([]),
    reflectionIds: z.array(z.string().regex(SAFE_ID_REGEX, 'Invalid reflection ID format')).max(20).optional().default([]),
    commitmentIds: z.array(z.string().regex(SAFE_ID_REGEX, 'Invalid commitment ID format')).max(20).optional().default([]),
    documentIds: z.array(z.string().regex(SAFE_ID_REGEX, 'Invalid document ID format')).max(20).optional().default([]),
    locationContext: locationContextSchema.optional().nullable(),
  })
  .refine(
    (data) => {
      return (
        data.memoryIds.length > 0 ||
        data.reflectionIds.length > 0 ||
        data.commitmentIds.length > 0 ||
        data.documentIds.length > 0 ||
        (typeof data.narrative === 'string' && data.narrative.trim().length > 0) ||
        (typeof data.userNotes === 'string' && data.userNotes.trim().length > 0)
      );
    },
    { message: 'A Moment must be grounded in at least one memory, reflection, document, or personal narrative/note.' }
  );

/**
 * POST /api/moments
 * Synthesizes or persists a new Vault Moment milestone.
 * Validates ownership of all referenced memories, reflections, and commitments.
 */
router.post('/', requireAuth, momentsRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User must be authenticated.' });
      return;
    }

    const parseResult = createMomentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: parseResult.error.issues[0]?.message || 'Invalid moment payload.',
      });
      return;
    }

    const {
      title: requestedTitle,
      narrative: requestedNarrative,
      userNotes,
      occurredAt,
      memoryIds,
      reflectionIds,
      commitmentIds,
      documentIds,
      locationContext,
    } = parseResult.data;

    // 1. Verify and fetch referenced memories (ownership guarantee)
    const validMemories: Array<{ id: string; fact: string; category: string }> = [];
    if (memoryIds.length > 0) {
      const memoryRefs = memoryIds.map((id) =>
        adminDb.collection('users').doc(userId).collection('memories').doc(id)
      );
      const memorySnaps = await adminDb.getAll(...memoryRefs);
      for (const snap of memorySnaps) {
        if (!snap.exists) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Referenced memory '${snap.id}' does not exist or does not belong to you.`,
          });
          return;
        }
        const data = snap.data();
        validMemories.push({
          id: snap.id,
          fact: typeof data?.fact === 'string' ? data.fact : '',
          category: typeof data?.category === 'string' ? data.category : 'important_context',
        });
      }
    }

    // 2. Verify and fetch referenced reflections (ownership guarantee)
    const validReflections: Array<{ id: string; title: string; excerpt?: string }> = [];
    if (reflectionIds.length > 0) {
      const reflectionRefs = reflectionIds.map((id) =>
        adminDb.collection('users').doc(userId).collection('sessions').doc(id)
      );
      const reflectionSnaps = await adminDb.getAll(...reflectionRefs);
      for (const snap of reflectionSnaps) {
        if (!snap.exists) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Referenced reflection '${snap.id}' does not exist or does not belong to you.`,
          });
          return;
        }
        const data = snap.data();
        validReflections.push({
          id: snap.id,
          title: typeof data?.title === 'string' ? data.title : 'Reflection Session',
          excerpt: typeof data?.summary === 'string' ? data.summary : undefined,
        });
      }
    }

    // 3. Verify referenced commitments (ownership guarantee)
    const validCommitmentIds: string[] = [];
    if (commitmentIds.length > 0) {
      const commitmentRefs = commitmentIds.map((id) =>
        adminDb.collection('users').doc(userId).collection('commitments').doc(id)
      );
      const commitmentSnaps = await adminDb.getAll(...commitmentRefs);
      for (const snap of commitmentSnaps) {
        if (!snap.exists) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Referenced commitment '${snap.id}' does not exist or does not belong to you.`,
          });
          return;
        }
        validCommitmentIds.push(snap.id);
      }
    }

    // 4. Synthesize narrative via Gemini if not explicitly provided
    let finalTitle = requestedTitle?.trim() || '';
    let finalNarrative = requestedNarrative?.trim() || '';
    let synthesizedBy = 'manual';

    if (!finalTitle || !finalNarrative) {
      const synthesis = await synthesizeMomentNarrativeWithFallback({
        memories: validMemories,
        reflections: validReflections,
        userNotes,
      });

      if (!finalTitle) finalTitle = synthesis.title;
      if (!finalNarrative) finalNarrative = synthesis.narrative;
      synthesizedBy = 'gemini-3.1-flash-lite';
    }

    // 5. Build and persist authoritative Vault Moment
    const momentId = `moment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const momentDocRef = adminDb.collection('users').doc(userId).collection('moments').doc(momentId);

    const momentPayload: Record<string, unknown> = {
      id: momentId,
      userId,
      title: finalTitle,
      narrative: finalNarrative,
      userNotes: userNotes?.trim() || '',
      occurredAt: occurredAt || new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      memoryIds: validMemories.map((m) => m.id),
      reflectionIds: validReflections.map((r) => r.id),
      commitmentIds: validCommitmentIds,
      documentIds,
      locationContext: locationContext || null,
      provenance: {
        sourceRecordCount:
          validMemories.length +
          validReflections.length +
          validCommitmentIds.length +
          documentIds.length,
        memoryCount: validMemories.length,
        reflectionCount: validReflections.length,
        commitmentCount: validCommitmentIds.length,
        documentCount: documentIds.length,
        synthesizedBy,
      },
      status: 'active',
    };

    await momentDocRef.set(momentPayload);

    // Return the created moment with ISO string timestamps for client convenience
    res.status(201).json({
      success: true,
      moment: {
        ...momentPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[Moments Route] Create error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create Vault Moment.',
    });
  }
});

/**
 * GET /api/moments
 * Retrieves all moments for the authenticated user, ordered chronologically.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User must be authenticated.' });
      return;
    }

    const momentsSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('moments')
      .get();

    const moments: unknown[] = [];
    momentsSnap.forEach((doc) => {
      const data = doc.data();
      const rawCreatedAt = data.createdAt;
      const createdAt =
        rawCreatedAt instanceof Timestamp
          ? rawCreatedAt.toDate().toISOString()
          : typeof rawCreatedAt === 'string'
          ? rawCreatedAt
          : null;

      moments.push({
        ...data,
        id: doc.id,
        createdAt,
      });
    });

    // Sort by occurredAt desc or createdAt desc
    moments.sort((a: any, b: any) => {
      const timeA = new Date(a.occurredAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.occurredAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.json({ moments });
  } catch (error: unknown) {
    console.error('[Moments Route] List error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch Vault Moments.',
    });
  }
});

/**
 * GET /api/moments/:id
 * Retrieves a single moment for the authenticated user.
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User must be authenticated.' });
      return;
    }

    const momentId = String(req.params.id || '');
    if (!SAFE_ID_REGEX.test(momentId)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid moment ID format.' });
      return;
    }

    const momentDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('moments')
      .doc(momentId)
      .get();

    if (!momentDoc.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Moment not found.' });
      return;
    }

    const data = momentDoc.data();
    const rawCreatedAt = data?.createdAt;
    const createdAt =
      rawCreatedAt instanceof Timestamp
        ? rawCreatedAt.toDate().toISOString()
        : typeof rawCreatedAt === 'string'
        ? rawCreatedAt
        : null;

    res.json({
      moment: {
        ...data,
        id: momentDoc.id,
        createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('[Moments Route] Get error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve Vault Moment.',
    });
  }
});

/**
 * DELETE /api/moments/:id
 * Deletes a moment owned by the authenticated user.
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User must be authenticated.' });
      return;
    }

    const momentId = String(req.params.id || '');
    if (!SAFE_ID_REGEX.test(momentId)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid moment ID format.' });
      return;
    }

    const momentRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('moments')
      .doc(momentId);

    const snap = await momentRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Moment not found.' });
      return;
    }

    await momentRef.delete();
    res.json({ success: true, message: 'Moment deleted.' });
  } catch (error: unknown) {
    console.error('[Moments Route] Delete error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete Vault Moment.',
    });
  }
});

export default router;
