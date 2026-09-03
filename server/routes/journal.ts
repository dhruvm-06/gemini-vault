import { Router, Response } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateJournalResponseWithFallback, ConversationTurn } from '../gemini';

const router = Router();

// Zod validation schemas
const chatRequestSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required').max(128),
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message exceeds 10,000 character limit'),
  clientMessageId: z.string().max(128).optional(),
});

const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  draftContent: z.string().max(10000).optional(),
  clientStartedAt: z.string().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  draftContent: z.string().max(10000).optional(),
});

/**
 * POST /api/journal/chat
 * Primary multi-turn conversational journaling endpoint.
 * Persists user message, passes bounded history to Gemini, saves AI response, and returns both.
 */
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawBody = (req.body && typeof req.body === 'object') ? req.body : {};
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid payload parameters.',
        details: parseResult.error.issues,
      });
      return;
    }

    const { sessionId, message, clientMessageId } = parseResult.data;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User context is missing.' });
      return;
    }

    const sessionRef = adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      res.status(404).json({
        error: 'Not Found',
        message: `Session '${sessionId}' does not exist or does not belong to the authenticated user.`,
      });
      return;
    }

    const sessionData = sessionSnap.data();
    if (sessionData?.status === 'completed') {
      res.status(400).json({
        error: 'Session Concluded',
        message: 'This reflection session has already been concluded and is read-only.',
      });
      return;
    }

    const messagesCol = sessionRef.collection('messages');

    // 1. Check for Idempotency / Prevent Duplicate User Message
    const userMsgId = clientMessageId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const existingUserDoc = await messagesCol.doc(userMsgId).get();

    const userMessagePayload = {
      id: userMsgId,
      role: 'user',
      content: message.trim(),
      clientTimestamp: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    };

    if (!existingUserDoc.exists) {
      await messagesCol.doc(userMsgId).set(userMessagePayload);
    }

    // 2. Fetch Bounded Context (Last 16 messages for bounded token safety)
    const recentMessagesSnap = await messagesCol
      .orderBy('timestamp', 'asc')
      .limitToLast(16)
      .get();

    const history: ConversationTurn[] = [];
    recentMessagesSnap.forEach((doc) => {
      const data = doc.data();
      // Skip the current new message from history turn list to avoid duplication
      if (doc.id !== userMsgId && data.content && (data.role === 'user' || data.role === 'assistant')) {
        history.push({
          role: data.role as 'user' | 'assistant',
          content: data.content,
        });
      }
    });

    // 3. Call Gemini Model with Fallback Ladder
    let aiResponseText = '';
    try {
      const geminiResult = await generateJournalResponseWithFallback(history, message.trim());
      aiResponseText = geminiResult.text;
    } catch (geminiError: unknown) {
      console.error('[Journal Route] Gemini generation error:', geminiError);
      res.status(502).json({
        error: 'AI Generation Failed',
        message: 'The reflective companion is temporarily unavailable. Your message was saved. Please retry.',
        userMessage: {
          id: userMsgId,
          role: 'user',
          content: message.trim(),
          clientTimestamp: userMessagePayload.clientTimestamp,
        },
      });
      return;
    }

    // 4. Persist AI Response via Trusted Backend
    const aiMsgId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const aiMessagePayload = {
      id: aiMsgId,
      role: 'assistant',
      content: aiResponseText,
      clientTimestamp: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
    };

    await messagesCol.doc(aiMsgId).set(aiMessagePayload);

    // 5. Update session metadata (clear draft content, update word count estimate)
    const currentWordCount = (sessionData?.wordCount || 0) + message.trim().split(/\s+/).length + aiResponseText.split(/\s+/).length;
    await sessionRef.update({
      draftContent: '',
      wordCount: currentWordCount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      userMessage: {
        id: userMsgId,
        role: 'user',
        content: message.trim(),
        clientTimestamp: userMessagePayload.clientTimestamp,
      },
      assistantMessage: {
        id: aiMsgId,
        role: 'assistant',
        content: aiResponseText,
        clientTimestamp: aiMessagePayload.clientTimestamp,
      },
    });
  } catch (error: unknown) {
    console.error('[Journal Route] Unexpected error in /api/journal/chat:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing the journal interaction.',
    });
  }
});

/**
 * POST /api/journal/session
 * Create or initialize a new reflection session.
 */
router.post('/session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawBody = (req.body && typeof req.body === 'object') ? req.body : {};
    const parseResult = createSessionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      res.status(400).json({ error: 'Bad Request', details: parseResult.error.issues });
      return;
    }

    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionRef = adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId);

    const now = new Date();
    const defaultTitle = parseResult.data.title || `Reflection: ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    const newSession = {
      id: sessionId,
      userId,
      title: defaultTitle,
      draftContent: parseResult.data.draftContent || '',
      clientStartedAt: parseResult.data.clientStartedAt || now.toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      status: 'active',
      wordCount: 0,
    };

    await sessionRef.set(newSession);

    res.status(201).json({
      session: {
        ...newSession,
        createdAt: now.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[Journal Route] Error creating session:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create journal session.' });
  }
});

/**
 * GET /api/journal/sessions
 * List all journal sessions for the authenticated user.
 */
router.get('/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessionsSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const sessions: unknown[] = [];
    sessionsSnap.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        ...data,
        id: doc.id,
      });
    });

    res.json({ sessions });
  } catch (error: unknown) {
    console.error('[Journal Route] Error listing sessions:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve sessions.' });
  }
});

/**
 * GET /api/journal/session/:sessionId/messages
 * Retrieve chronological messages for a specific session.
 */
router.get('/session/:sessionId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

    if (!userId || !sessionId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User or session is invalid.' });
      return;
    }

    // Verify ownership
    const sessionDoc = await adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Session not found or unauthorized.' });
      return;
    }

    const messagesSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages: unknown[] = [];
    messagesSnap.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        role: data.role,
        content: data.content,
        clientTimestamp: data.clientTimestamp,
        timestamp: data.timestamp,
      });
    });

    res.json({
      session: sessionDoc.data(),
      messages,
    });
  } catch (error: unknown) {
    console.error('[Journal Route] Error fetching session messages:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve messages.' });
  }
});

/**
 * PATCH /api/journal/session/:sessionId
 * Update session title or draftContent.
 */
router.patch('/session/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const rawBody = (req.body && typeof req.body === 'object') ? req.body : {};
    const parseResult = updateSessionSchema.safeParse(rawBody);

    if (!userId || !sessionId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!parseResult.success) {
      res.status(400).json({ error: 'Bad Request', details: parseResult.error.issues });
      return;
    }

    const sessionRef = adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Session not found.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parseResult.data.title !== undefined) updates.title = parseResult.data.title;
    if (parseResult.data.draftContent !== undefined) updates.draftContent = parseResult.data.draftContent;

    if (Object.keys(updates).length > 0) {
      await sessionRef.update(updates);
    }

    res.json({ success: true, sessionId, updates });
  } catch (error: unknown) {
    console.error('[Journal Route] Error updating session:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update session.' });
  }
});

/**
 * POST /api/journal/session/:sessionId/conclude
 * Conclude an active reflection session, marking it completed.
 */
router.post('/session/:sessionId/conclude', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

    if (!userId || !sessionId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessionRef = adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Session not found or unauthorized.' });
      return;
    }

    const sessionData = sessionDoc.data();
    if (sessionData?.status === 'completed') {
      res.json({ success: true, sessionId, status: 'completed', alreadyCompleted: true });
      return;
    }

    await sessionRef.update({
      status: 'completed',
      endedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Journal Route] Concluded session ${sessionId} for user ${userId}`);

    res.json({
      success: true,
      sessionId,
      status: 'completed',
      message: 'Reflection session concluded successfully.',
    });
  } catch (error: unknown) {
    console.error('[Journal Route] Error concluding session:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to conclude session.' });
  }
});

export default router;
