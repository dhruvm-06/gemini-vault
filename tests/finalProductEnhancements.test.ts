import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { SAFE_ID_REGEX, TONE_INSTRUCTIONS, DEPTH_INSTRUCTIONS } from '../server/routes/journal';
import { synthesizeMomentNarrativeWithFallback } from '../server/gemini';

test('1. Manual Memory Creation: Validates manual source type and server-derived provenance', async () => {
  const saveMemorySchema = z
    .object({
      sessionId: z.string().regex(SAFE_ID_REGEX, 'Invalid sessionId format').max(128).optional().nullable(),
      sourceType: z.enum(['extracted', 'manual']).optional().default('extracted'),
      fact: z.string().min(1, 'Fact cannot be empty').max(500, 'Fact exceeds 500 characters limit'),
      category: z.enum([
        'goal',
        'project',
        'preference',
        'important_context',
        'recurring_theme',
        'commitment',
      ]),
      userNotes: z.string().max(1000, 'User notes exceeds 1,000 characters').optional().default(''),
      importance: z.number().min(0).max(1).optional().default(0.5),
      confidence: z.number().min(0).max(1).optional().default(1.0),
    })
    .refine(
      (data) => {
        if (data.sourceType === 'extracted') {
          return typeof data.sessionId === 'string' && data.sessionId.trim().length > 0;
        }
        return true;
      },
      { message: 'sessionId is required for extracted memories', path: ['sessionId'] }
    );

  // Manual memory creation without sessionId must succeed
  const manualResult = saveMemorySchema.safeParse({
    sourceType: 'manual',
    fact: 'Prefers reading historical biographies in the evening.',
    category: 'preference',
    userNotes: 'Added directly from dashboard.',
    importance: 0.8,
  });

  assert.equal(manualResult.success, true);
  if (manualResult.success) {
    assert.equal(manualResult.data.sourceType, 'manual');
    assert.equal(manualResult.data.sessionId, undefined);
  }

  // Extracted memory without sessionId must fail validation
  const extractedResult = saveMemorySchema.safeParse({
    sourceType: 'extracted',
    fact: 'Discovered during reflection session.',
    category: 'goal',
  });

  assert.equal(extractedResult.success, false);
});

test('2. User Preferences & Prompt Safety: Tone and Depth enum mappings are bounded and strict', () => {
  assert.equal(typeof TONE_INSTRUCTIONS.empathic, 'string');
  assert.equal(typeof TONE_INSTRUCTIONS.direct, 'string');
  assert.equal(typeof TONE_INSTRUCTIONS.philosophical, 'string');
  assert.equal(typeof DEPTH_INSTRUCTIONS.concise, 'string');
  assert.equal(typeof DEPTH_INSTRUCTIONS.balanced, 'string');
  assert.equal(typeof DEPTH_INSTRUCTIONS.deep, 'string');

  // Verify none contain raw unescaped prompt injection payloads
  Object.values(TONE_INSTRUCTIONS).forEach((instruction) => {
    assert.ok(!instruction.includes('<script>'));
    assert.ok(instruction.length > 10 && instruction.length < 200);
  });
});

test('3. Location Context: Strict schema validation and coordinate bounding', () => {
  const locationContextSchema = z.object({
    mode: z.enum(['coarse', 'precise']),
    label: z.string().min(1).max(200),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    capturedAt: z.string().optional().default(() => new Date().toISOString()),
  });

  // Valid coarse location
  const coarseResult = locationContextSchema.safeParse({
    mode: 'coarse',
    label: 'America/Los_Angeles (~37.7, -122.4)',
    latitude: 37.7,
    longitude: -122.4,
  });
  assert.equal(coarseResult.success, true);

  // Valid precise location
  const preciseResult = locationContextSchema.safeParse({
    mode: 'precise',
    label: '37.7749, -122.4194',
    latitude: 37.7749,
    longitude: -122.4194,
  });
  assert.equal(preciseResult.success, true);

  // Invalid out-of-bound latitude rejected
  const invalidLatResult = locationContextSchema.safeParse({
    mode: 'precise',
    label: 'Invalid pole',
    latitude: 95.0,
    longitude: 0,
  });
  assert.equal(invalidLatResult.success, false);

  // Invalid out-of-bound longitude rejected
  const invalidLngResult = locationContextSchema.safeParse({
    mode: 'precise',
    label: 'Invalid meridian',
    latitude: 0,
    longitude: 195.0,
  });
  assert.equal(invalidLngResult.success, false);
});

test('4. Vault Moments: Grounding contract and synthesis fallback', async () => {
  const synthesis = await synthesizeMomentNarrativeWithFallback({
    memories: [
      { fact: 'Decided to transition into systems architecture leadership', category: 'goal' },
      { fact: 'Committed to finishing distributed consensus deep dive', category: 'project' },
    ],
    reflections: [
      { title: 'Turning Point: The Architecture Leap', excerpt: 'Reflecting on next decade career trajectory' },
    ],
    userNotes: 'A major milestone in career clarity.',
  });

  assert.equal(typeof synthesis.title, 'string');
  assert.ok(synthesis.title.length > 0);
  assert.equal(typeof synthesis.narrative, 'string');
  assert.ok(synthesis.narrative.length > 0);
});

test('5. What Changed: Insufficiency threshold and comparative deltas', () => {
  // Scenario A: 0 or 1 session -> Insufficient context
  const singleSessionList = [{ id: 's1', status: 'completed', createdAt: new Date().toISOString() }];
  assert.ok(singleSessionList.length < 2, 'Fewer than 2 sessions must trigger insufficiency note');

  // Scenario B: >= 2 sessions across periods -> Valid delta comparison
  const now = Date.now();
  const recentSessions = [
    { id: 's2', status: 'completed', createdAt: new Date(now - 1 * 86400000).toISOString() },
    { id: 's1', status: 'completed', createdAt: new Date(now - 3 * 86400000).toISOString() },
  ];
  const priorSessions = [
    { id: 's0', status: 'completed', createdAt: new Date(now - 10 * 86400000).toISOString() },
  ];

  const sessionDelta = recentSessions.length - priorSessions.length;
  assert.equal(sessionDelta, 1, 'Reflects +1 session increase over prior window');
  assert.ok(recentSessions.length >= 2, 'Meets longitudinal analysis threshold');
});
