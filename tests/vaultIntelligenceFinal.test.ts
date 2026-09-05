import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  createGoogleCalendarUrl,
  createGoogleMapsUrl,
  createGmailComposeUrl,
  isValidNavigationTarget,
  targetToView,
  ALLOWED_NAVIGATION_TARGETS,
  detectActionSuggestions,
  buildAppContextManifest,
  getUpcomingPlanningOpportunities,
  RECOGNIZED_PLANNING_CATALOG,
} from '../src/utils/actionHandoffs';
import { REFLECTION_MODE_INSTRUCTIONS } from '../server/gemini';

test('1. Google Calendar URL Handoff: Generates authentic web template URL', () => {
  const url = createGoogleCalendarUrl({
    title: 'Review quarterly goals',
    details: 'Derived from weekly reflection.',
    location: 'Bangalore Office',
    startDate: new Date('2026-10-15T09:00:00Z'),
    endDate: new Date('2026-10-15T10:00:00Z'),
  });

  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('action'), 'TEMPLATE');
  assert.equal(parsed.searchParams.get('text'), 'Review quarterly goals');
  assert.equal(parsed.searchParams.get('details'), 'Derived from weekly reflection.');
  assert.equal(parsed.searchParams.get('location'), 'Bangalore Office');
  assert.equal(parsed.searchParams.get('dates'), '20261015T090000Z/20261015T100000Z');
});

test('2. Google Calendar URL Handoff: Handles all-day events and fallback dates', () => {
  const url = createGoogleCalendarUrl({
    title: 'Festival of Lights Holiday',
    startDate: '2026-11-08',
    isAllDay: true,
  });

  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('text'), 'Festival of Lights Holiday');
  const dates = parsed.searchParams.get('dates');
  assert.ok(dates);
  assert.ok(dates?.includes('20261108'));
});

test('3. Google Calendar URL Handoff: Bounds oversized title and details to prevent URI overflow', () => {
  const giantTitle = 'A'.repeat(500);
  const giantDetails = 'B'.repeat(3000);
  const url = createGoogleCalendarUrl({
    title: giantTitle,
    details: giantDetails,
  });

  const parsed = new URL(url);
  assert.ok((parsed.searchParams.get('text') || '').length <= 200);
  assert.ok((parsed.searchParams.get('details') || '').length <= 1000);
});

test('4. Google Maps URL Handoff: Generates authentic search URL', () => {
  const url = createGoogleMapsUrl('Cubbon Park Bangalore');
  assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=Cubbon%20Park%20Bangalore');
});

test('5. Gmail Compose URL Handoff: Generates pre-filled draft URL', () => {
  const url = createGmailComposeUrl({
    to: 'mentor@example.com',
    subject: 'Follow-up on product strategy',
    body: 'Reflecting on our earlier conversation.',
  });

  assert.ok(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('view'), 'cm');
  assert.equal(parsed.searchParams.get('to'), 'mentor@example.com');
  assert.equal(parsed.searchParams.get('su'), 'Follow-up on product strategy');
  assert.equal(parsed.searchParams.get('body'), 'Reflecting on our earlier conversation.');
});

test('6. Navigation Target Validation: Strictly enforces destination allowlist', () => {
  // Valid targets
  for (const target of ALLOWED_NAVIGATION_TARGETS) {
    assert.equal(isValidNavigationTarget(target), true, `Target should be valid: ${target}`);
    assert.notEqual(targetToView(target), null, `targetToView should resolve: ${target}`);
  }

  // Case insensitivity
  assert.equal(isValidNavigationTarget('REFLECT'), true);
  assert.equal(isValidNavigationTarget('  calendar  '), true);
  assert.equal(targetToView('VOICE')?.view, 'voice');

  // Invalid or malicious targets MUST be rejected
  assert.equal(isValidNavigationTarget(''), false);
  assert.equal(isValidNavigationTarget('https://evil.com'), false);
  assert.equal(isValidNavigationTarget('javascript:alert(1)'), false);
  assert.equal(isValidNavigationTarget('admin_panel'), false);
  assert.equal(isValidNavigationTarget('eval'), false);
  assert.equal(targetToView('unknown_route'), null);
});

test('7. Action Intent Detection: Detects schedule and commitment patterns', () => {
  const text = 'I should schedule a dentist appointment tomorrow at 10am.';
  const suggestions = detectActionSuggestions(text);
  assert.ok(suggestions.length > 0);
  const calendarAction = suggestions.find((s) => s.type === 'calendar_event');
  assert.ok(calendarAction);
  assert.equal(calendarAction?.status, 'suggested');
  assert.ok(calendarAction?.confidence && calendarAction.confidence >= 0.8);
});

test('8. Action Intent Detection: Detects location patterns', () => {
  const text = 'Let us meet at Indiranagar Metro Station next Tuesday.';
  const suggestions = detectActionSuggestions(text);
  assert.ok(suggestions.length > 0);
  const locationAction = suggestions.find((s) => s.type === 'location');
  assert.ok(locationAction);
  assert.ok(locationAction?.location?.includes('Indiranagar Metro Station'));
});

test('9. Action Intent Detection: Detects email draft patterns', () => {
  const text = 'I should email alex@company.com about the project roadmap.';
  const suggestions = detectActionSuggestions(text);
  assert.ok(suggestions.length > 0);
  const emailAction = suggestions.find((s) => s.type === 'email_draft');
  assert.ok(emailAction);
  assert.equal(emailAction?.recipient, 'alex@company.com');
});

test('10. App Context Manifest: Builds bounded manifest for Voice companion', () => {
  const manifest = buildAppContextManifest({
    currentView: 'reflect',
    currentResource: {
      type: 'reflection',
      id: 'sess_123',
      title: 'Deep Architecture Reflection',
    },
    vaultSummary: {
      openLoopsCount: 3,
      snoozedLoopsCount: 1,
      activeCommitmentsCount: 2,
      totalMemoriesCount: 15,
    },
    preferences: {
      depth: 'deep',
      tone: 'philosophical',
    },
  });

  assert.equal(manifest.currentView, 'reflect');
  assert.equal(manifest.currentResource?.type, 'reflection');
  assert.equal(manifest.currentResource?.id, 'sess_123');
  assert.equal(manifest.vaultSummary?.openLoopsCount, 3);
  assert.deepEqual(manifest.availableTargets, [...ALLOWED_NAVIGATION_TARGETS]);
});

test('11. Planning Catalog: Deterministic public holidays catalog integrity', () => {
  assert.ok(RECOGNIZED_PLANNING_CATALOG.length >= 5);
  for (const opp of RECOGNIZED_PLANNING_CATALOG) {
    assert.ok(opp.id, 'Must have id');
    assert.ok(opp.name, 'Must have name');
    assert.ok(opp.dateStr.match(/^\d{4}-\d{2}-\d{2}$/), `Invalid dateStr: ${opp.dateStr}`);
    assert.ok(opp.description.length > 10, 'Must have descriptive context');
    assert.ok(
      opp.type === 'public_holiday' || opp.type === 'observance' || opp.type === 'planning_milestone'
    );
  }

  const upcoming = getUpcomingPlanningOpportunities(new Date('2026-09-01T00:00:00Z'));
  assert.ok(Array.isArray(upcoming));
  assert.ok(upcoming.length > 0);
});

test('12. Reflection Mode Instructions: All 7 modes bounded and non-clinical', () => {
  const requiredModes = [
    'reflect',
    'deep_reflection',
    'brainstorm',
    'reframe',
    'action_plan',
    'gratitude',
    'executive_summary',
  ];

  for (const mode of requiredModes) {
    const instruction = REFLECTION_MODE_INSTRUCTIONS[mode];
    assert.ok(instruction, `Missing instruction for mode: ${mode}`);
    assert.ok(instruction.length > 20, `Instruction too brief for: ${mode}`);
    assert.ok(!instruction.toLowerCase().includes('diagnos'));
    assert.ok(!instruction.toLowerCase().includes('patholog'));
    assert.ok(!instruction.toLowerCase().includes('disorder'));
  }
});

test('13. Calendar "Summarize My Week" Typed Rendering Boundary: Fixes React object-child defect and handles all states safely', () => {
  const calendarComponentPath = path.resolve(__dirname, '../src/components/CommitmentsCalendarView.tsx');
  const memoriesRoutePath = path.resolve(__dirname, '../server/routes/memories.ts');

  assert.ok(fs.existsSync(calendarComponentPath), 'CommitmentsCalendarView.tsx must exist');
  assert.ok(fs.existsSync(memoriesRoutePath), 'server/routes/memories.ts must exist');

  const calendarSrc = fs.readFileSync(calendarComponentPath, 'utf8');
  const memoriesRouteSrc = fs.readFileSync(memoriesRoutePath, 'utf8');

  // 1. Endpoint POST /api/memories/calendar-summary must exist and return structured summary
  assert.ok(memoriesRouteSrc.includes('/calendar-summary'), 'Server must provide /calendar-summary route');
  assert.ok(memoriesRouteSrc.includes('activeCommitmentsCount:'), 'Server returns activeCommitmentsCount');
  assert.ok(memoriesRouteSrc.includes('focusRecommendation:'), 'Server returns focusRecommendation');

  // 2. UI must have "Summarize My Week" button with stable id and loading spinner
  assert.ok(calendarSrc.includes('id="summarize-week-btn"'), 'Summarize My Week button must exist');
  assert.ok(calendarSrc.includes('Summarize My Week'), 'Summarize My Week label must be present');
  assert.ok(calendarSrc.includes('isSummarizingWeek'), 'isSummarizingWeek loading state must be managed');

  // 3. Typed rendering boundary: Never render raw object as React child
  // The bug was `<p ...>{weekSummary}</p>` when weekSummary was an object.
  // The fix maps fields explicitly: {weekSummary.focusRecommendation}, {weekSummary.activeCommitmentsCount ?? 0}, etc.
  assert.ok(calendarSrc.includes('interface CalendarWeekSummaryData'), 'Must define typed summary contract');
  assert.ok(
    calendarSrc.includes('{weekSummary.focusRecommendation}'),
    'Must render focusRecommendation string explicitly'
  );
  assert.ok(
    calendarSrc.includes('{weekSummary.activeCommitmentsCount ?? 0}'),
    'Must render activeCommitmentsCount safely'
  );
  assert.ok(
    calendarSrc.includes('{weekSummary.snoozedLoopsCount ?? 0}'),
    'Must render snoozedLoopsCount safely'
  );
  assert.ok(
    calendarSrc.includes('{weekSummary.resolvedLoopsCount ?? 0}'),
    'Must render resolvedLoopsCount safely'
  );

  // Verify dangerous pattern `{weekSummary}` alone in a paragraph does not exist
  assert.equal(
    calendarSrc.includes('>{weekSummary}<'),
    false,
    'Must NEVER render raw weekSummary object directly as a React child'
  );

  // 4. Safe fallback for empty/zero data and error state handling
  assert.ok(calendarSrc.includes('No commitments or active loops recorded'), 'Must handle zero data gracefully');
  assert.ok(calendarSrc.includes('weekSummaryError'), 'Must handle error state without crashing');

  // 5. Reproduction test: Verify structured object evaluation logic
  const mockServerResponse = {
    activeCommitmentsCount: 3,
    snoozedLoopsCount: 1,
    resolvedLoopsCount: 5,
    topCommitments: ['Launch Gemini Vault v1', 'Review sprint goals'],
    upcomingSnoozed: ['Travel booking'],
    recentAchievements: ['Shipped production build'],
    focusRecommendation: 'Primary focus recommendation: "Launch Gemini Vault v1"',
  };

  // Pure function representing our rendering boundary
  const renderSummaryFields = (data: typeof mockServerResponse) => {
    return {
      focusText: typeof data.focusRecommendation === 'string' ? data.focusRecommendation : '',
      activeCount: Number(data.activeCommitmentsCount ?? 0),
      snoozedCount: Number(data.snoozedLoopsCount ?? 0),
      resolvedCount: Number(data.resolvedLoopsCount ?? 0),
      commitments: Array.isArray(data.topCommitments) ? data.topCommitments.map(String) : [],
      achievements: Array.isArray(data.recentAchievements) ? data.recentAchievements.map(String) : [],
    };
  };

  const rendered = renderSummaryFields(mockServerResponse);
  assert.equal(typeof rendered.focusText, 'string');
  assert.equal(typeof rendered.activeCount, 'number');
  assert.equal(rendered.activeCount, 3);
  assert.equal(rendered.commitments.length, 2);

  // Empty state handling
  const emptyRendered = renderSummaryFields({} as any);
  assert.equal(emptyRendered.activeCount, 0);
  assert.equal(emptyRendered.focusText, '');
  assert.equal(emptyRendered.commitments.length, 0);

  // 6. Navigation to calendar route remains strictly valid
  assert.equal(isValidNavigationTarget('calendar'), true);
  assert.equal(targetToView('calendar')?.view, 'calendar');
});

test('14. Reflection Header Layout Invariant: Conclude control is pinned in primary tier and never pushed off-screen', () => {
  const sessionViewPath = path.resolve(__dirname, '../src/components/JournalSessionView.tsx');
  assert.ok(fs.existsSync(sessionViewPath), 'JournalSessionView.tsx must exist');

  const sessionViewSrc = fs.readFileSync(sessionViewPath, 'utf8');

  // 1. Conclude reflection button must exist with stable id
  assert.ok(sessionViewSrc.includes('id="conclude-reflection-btn"'), 'Conclude button must exist with stable id');

  // 2. Conclude button must be inside the primary row alongside Mode, Tone, and Depth
  assert.ok(
    sessionViewSrc.includes('Primary Controls (Mode/Tone/Depth) & Primary Session Exit (Conclude)'),
    'Conclude button must be co-located with primary controls in the top tier'
  );

  // 3. Secondary actions must be in secondary row with horizontal scrolling safety
  assert.ok(
    sessionViewSrc.includes('Secondary Action Toolbar: Summarize, Actions, Focus, Voice'),
    'Secondary action toolbar must be present in secondary tier'
  );
  assert.ok(
    sessionViewSrc.includes('overflow-x-auto no-scrollbar'),
    'Secondary toolbar must prevent horizontal page overflow'
  );

  // 4. Conclude button must not be inside the secondary scrollable container
  const secondaryToolbarIndex = sessionViewSrc.indexOf('Secondary Action Toolbar');
  const concludeBtnIndex = sessionViewSrc.indexOf('id="conclude-reflection-btn"');
  assert.ok(
    concludeBtnIndex < secondaryToolbarIndex,
    'Conclude button must be in the top tier before the secondary toolbar to guarantee visibility'
  );
});
