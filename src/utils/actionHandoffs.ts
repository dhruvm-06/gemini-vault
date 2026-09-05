import { ActionSuggestion, ActionType, AppView, GlobalAppContext } from '../types';

/**
 * Strict allowlist of permitted navigation destinations in Gemini Vault.
 * Never navigate to arbitrary model-generated targets or URLs.
 */
export const ALLOWED_NAVIGATION_TARGETS = [
  'reflect',
  'voice',
  'vault',
  'moments',
  'intelligence',
  'documents',
  'calendar',
  'settings',
] as const;

export type AllowedNavigationTarget = typeof ALLOWED_NAVIGATION_TARGETS[number];

export function isValidNavigationTarget(target: string): target is AllowedNavigationTarget {
  if (!target || typeof target !== 'string') return false;
  const normalized = target.trim().toLowerCase();
  return (ALLOWED_NAVIGATION_TARGETS as readonly string[]).includes(normalized);
}

export function targetToView(target: string): { view: AppView; isSettings?: boolean } | null {
  if (!isValidNavigationTarget(target)) return null;
  const normalized = target.trim().toLowerCase();
  switch (normalized) {
    case 'reflect':
      return { view: 'home' };
    case 'voice':
      return { view: 'voice' };
    case 'vault':
      return { view: 'vault' };
    case 'moments':
      return { view: 'moments' };
    case 'intelligence':
      return { view: 'intelligence' };
    case 'documents':
      return { view: 'documents' };
    case 'calendar':
      return { view: 'calendar' };
    case 'settings':
      return { view: 'home', isSettings: true };
    default:
      return null;
  }
}

/**
 * Format a Date or ISO string into Google Calendar URL compact date string:
 * YYYYMMDDTHHmmssZ (for UTC timestamps) or YYYYMMDD (for all-day events).
 */
export function formatGoogleCalendarDate(dateInput: Date | string, isAllDay = false): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    // Fallback to next day 09:00 UTC if invalid
    const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);
    fallback.setUTCHours(9, 0, 0, 0);
    return formatGoogleCalendarDate(fallback, isAllDay);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());

  if (isAllDay) {
    return `${year}${month}${day}`;
  }

  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

export interface GoogleCalendarHandoffParams {
  title: string;
  details?: string;
  location?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  isAllDay?: boolean;
}

/**
 * Builds an authentic Google Calendar event-template URL handoff.
 * NOTE: This is a client-side URL template handoff, NOT a background Calendar API integration.
 * Users review and confirm in Google Calendar before saving.
 */
export function createGoogleCalendarUrl(params: GoogleCalendarHandoffParams): string {
  const title = (params.title || 'Gemini Vault Action').trim().slice(0, 200);
  const details = (params.details || 'Created from Gemini Vault reflection.').trim().slice(0, 1000);
  const location = (params.location || '').trim().slice(0, 200);

  // Default start to tomorrow 09:00 if not provided
  let start = params.startDate ? new Date(params.startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (isNaN(start.getTime())) {
    start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setHours(9, 0, 0, 0);
  }

  let end = params.endDate ? new Date(params.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
  if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const startFormatted = formatGoogleCalendarDate(start, params.isAllDay);
  const endFormatted = formatGoogleCalendarDate(end, params.isAllDay);
  const datesParam = `${startFormatted}/${endFormatted}`;

  const queryParams = new URLSearchParams();
  queryParams.set('action', 'TEMPLATE');
  queryParams.set('text', title);
  queryParams.set('dates', datesParam);
  if (details) queryParams.set('details', details);
  if (location) queryParams.set('location', location);

  return `https://calendar.google.com/calendar/render?${queryParams.toString()}`;
}

/**
 * Builds an authentic Google Maps search/directions URL handoff.
 * NOTE: This is a contextual browser URL handoff, NOT an embedded Maps API.
 */
export function createGoogleMapsUrl(query: string): string {
  const cleanQuery = (query || '').trim().slice(0, 200);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}`;
}

export interface GmailComposeHandoffParams {
  to?: string;
  subject: string;
  body: string;
}

/**
 * Builds an authentic Gmail prefilled compose URL handoff.
 * NOTE: This is a browser compose handoff, NOT an automated Gmail API send.
 * Shows disclaimer: "Opens Gmail — review before sending."
 */
export function createGmailComposeUrl(params: GmailComposeHandoffParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set('view', 'cm');
  queryParams.set('fs', '1');
  if (params.to && params.to.trim()) {
    queryParams.set('to', params.to.trim().slice(0, 150));
  }
  queryParams.set('su', (params.subject || 'Reflection Note').trim().slice(0, 150));
  queryParams.set('body', (params.body || '').trim().slice(0, 3000));

  return `https://mail.google.com/mail/?${queryParams.toString()}`;
}

/**
 * Builds a sanitized, authenticated Global App Context Manifest.
 * Strictly excludes auth tokens, secrets, API keys, and embeddings.
 */
export function buildAppContextManifest(options: {
  currentView: string;
  currentResource?: {
    type: 'document' | 'reflection' | 'moment' | 'none';
    id?: string;
    title?: string;
  };
  vaultSummary?: {
    openLoopsCount: number;
    snoozedLoopsCount: number;
    activeCommitmentsCount: number;
    totalMemoriesCount: number;
  };
  currentPreferences?: {
    depth?: string;
    tone?: string;
  };
}): GlobalAppContext {
  return {
    currentView: options.currentView || 'home',
    currentResource: options.currentResource || { type: 'none' },
    vaultSummary: options.vaultSummary || {
      openLoopsCount: 0,
      snoozedLoopsCount: 0,
      activeCommitmentsCount: 0,
      totalMemoriesCount: 0,
    },
    availableTargets: [...ALLOWED_NAVIGATION_TARGETS],
    currentPreferences: options.currentPreferences,
  };
}

/**
 * Deterministic action heuristic detection:
 * Identifies explicit commitments, calendar plans, locations, and email drafts from conversation turns.
 * Used for instant, zero-cost, reliable detection and validating AI model suggestions.
 */
export function detectActionSuggestions(
  text: string,
  context?: { sessionId?: string; messageId?: string }
): ActionSuggestion[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (trimmed.length < 5) return [];

  const suggestions: ActionSuggestion[] = [];

  // 1. Calendar / Location Plan Detection (e.g. "reach Chennai Central tomorrow morning", "visit ... at ...", "meet at ...")
  const reachLocationRegex = /(?:reach|visit|go to|travel to|head to|arrive at|meet at)\s+([A-Z][A-Za-z0-9\s,.-]+?)(?:\s+(?:tomorrow|by|before|at|on|next)\b|\.|$)/i;
  const reachMatch = trimmed.match(reachLocationRegex);
  if (reachMatch && reachMatch[1]) {
    const rawPlace = reachMatch[1].trim();
    // Exclude common noise words
    if (!/^(the|a|an|my|our|some)\s*$/i.test(rawPlace) && rawPlace.length > 2 && rawPlace.length < 60) {
      const isMorning = /morning/i.test(trimmed);
      const isTomorrow = /tomorrow/i.test(trimmed);
      const title = `Reach ${rawPlace}`;

      const targetDate = new Date();
      if (isTomorrow) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      if (isMorning) {
        targetDate.setHours(9, 0, 0, 0);
      } else {
        targetDate.setHours(14, 0, 0, 0);
      }

      suggestions.push({
        id: `act_${Date.now()}_loc`,
        type: 'calendar_event',
        title,
        description: `Plan detected from reflection: ${trimmed.slice(0, 150)}`,
        dateTime: targetDate.toISOString(),
        location: rawPlace,
        confidence: 0.9,
        sourceEvidence: trimmed.slice(0, 200),
        sourceSessionId: context?.sessionId,
        sourceMessageId: context?.messageId,
        status: 'suggested',
      });

      suggestions.push({
        id: `act_${Date.now()}_geo`,
        type: 'location',
        title: rawPlace,
        location: rawPlace,
        confidence: 0.95,
        sourceEvidence: trimmed.slice(0, 200),
        sourceSessionId: context?.sessionId,
        sourceMessageId: context?.messageId,
        status: 'suggested',
      });
    }
  }

  // 1b. Direct Schedule Intent Detection (e.g. "schedule a dentist appointment tomorrow at 10am")
  const scheduleRegex = /(?:schedule|book|plan|set up)\s+(?:a |an )?([^.!?\n]+?)\s+(?:tomorrow|by|before|at|on|next)\b/i;
  const scheduleMatch = trimmed.match(scheduleRegex);
  if (scheduleMatch && scheduleMatch[1]) {
    const rawEvent = scheduleMatch[1].trim();
    if (rawEvent.length > 2 && rawEvent.length < 60) {
      const isTomorrow = /tomorrow/i.test(trimmed);
      const targetDate = new Date();
      if (isTomorrow) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(10, 0, 0, 0);

      suggestions.push({
        id: `act_${Date.now()}_sch`,
        type: 'calendar_event',
        title: rawEvent.charAt(0).toUpperCase() + rawEvent.slice(1),
        description: `Scheduled action from reflection: "${trimmed.slice(0, 140)}"`,
        dateTime: targetDate.toISOString(),
        confidence: 0.85,
        sourceEvidence: trimmed.slice(0, 200),
        sourceSessionId: context?.sessionId,
        sourceMessageId: context?.messageId,
        status: 'suggested',
      });
    }
  }

  // 2. Commitment Detection (e.g. "I should finish the report by Friday", "I need to complete...")
  const commitmentRegex = /(?:I (?:need to|should|must|will|promise to|plan to|intend to)|Finish|Complete|Submit)\s+([^.!?\n]+(?:by|before|on|until)\s+[^.!?\n]+|[^.!?\n]{10,80})/i;
  const commitMatch = trimmed.match(commitmentRegex);
  if (commitMatch && commitMatch[1]) {
    const rawFact = commitMatch[1].trim();
    // Do not flag hypothetical or ambiguous phrases as confirmed commitments
    const isAmbiguous = /\b(maybe|someday|perhaps|might|if I can)\b/i.test(trimmed);
    if (!isAmbiguous && rawFact.length > 5 && rawFact.length < 120) {
      const cleanTitle = rawFact.charAt(0).toUpperCase() + rawFact.slice(1);
      suggestions.push({
        id: `act_${Date.now()}_com`,
        type: 'commitment',
        title: cleanTitle,
        description: `Commitment recognized from reflection: "${trimmed.slice(0, 140)}"`,
        confidence: 0.85,
        sourceEvidence: trimmed.slice(0, 200),
        sourceSessionId: context?.sessionId,
        sourceMessageId: context?.messageId,
        status: 'suggested',
      });
    }
  }

  // 3. Email Draft Detection (e.g. "I should send this to my mentor", "email Alex about...")
  const emailRegex = /(?:send (?:this|an? email|a note) to|email)\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:my\s+)?[A-Z][a-z]+|\bmentor\b|\bmanager\b|\bteam\b)(?:\s+about\s+([^.!?\n]+))?/i;
  const emailMatch = trimmed.match(emailRegex);
  if (emailMatch && emailMatch[1]) {
    const rawRecipient = emailMatch[1].trim();
    const topic = emailMatch[2]?.trim() || 'Reflection insights & next steps';
    const recipient = rawRecipient.includes('@') ? rawRecipient : undefined;
    suggestions.push({
      id: `act_${Date.now()}_eml`,
      type: 'email_draft',
      title: `Draft email regarding ${topic.slice(0, 40)}`,
      description: `Draft an email to ${rawRecipient}`,
      recipient,
      confidence: 0.85,
      sourceEvidence: trimmed.slice(0, 200),
      sourceSessionId: context?.sessionId,
      sourceMessageId: context?.messageId,
      status: 'suggested',
    });
  }

  return suggestions;
}

/**
 * Deterministic Upcoming Public Holidays / Observance Opportunities Catalog.
 * Strictly labeled as EXTERNAL CONTEXT for planning opportunities.
 */
export interface PlanningOpportunity {
  id: string;
  name: string;
  dateStr: string; // e.g. "2026-10-02"
  label: string; // e.g. "October 2"
  type: 'public_holiday' | 'observance' | 'planning_milestone';
  description: string;
}

export const RECOGNIZED_PLANNING_CATALOG: PlanningOpportunity[] = [
  {
    id: 'plan_gandhi_jayanti',
    name: 'Mahatma Gandhi Jayanti / Public Holiday',
    dateStr: '2026-10-02',
    label: 'October 2',
    type: 'public_holiday',
    description: 'National public holiday — prime opportunity for restorative reflection or personal project block.',
  },
  {
    id: 'plan_diwali',
    name: 'Diwali / Festival of Lights',
    dateStr: '2026-11-08',
    label: 'November 8',
    type: 'public_holiday',
    description: 'Festive season opportunity — family time, renewal, and closing lingering annual open loops.',
  },
  {
    id: 'plan_thanksgiving',
    name: 'Thanksgiving Weekend',
    dateStr: '2026-11-26',
    label: 'November 26',
    type: 'public_holiday',
    description: 'Gratitude reflection opportunity and seasonal recharge window.',
  },
  {
    id: 'plan_year_end',
    name: 'Year-End Review & Renewal',
    dateStr: '2026-12-31',
    label: 'December 31',
    type: 'planning_milestone',
    description: 'Annual milestone review — synthesize vault memories, celebrate wins, and set forward commitments.',
  },
  {
    id: 'plan_new_year',
    name: "New Year's Day",
    dateStr: '2027-01-01',
    label: 'January 1',
    type: 'public_holiday',
    description: 'Fresh calendar opening — establish foundational goals and reflection cadence for the year ahead.',
  },
  {
    id: 'plan_republic_day',
    name: 'Republic Day',
    dateStr: '2027-01-26',
    label: 'January 26',
    type: 'public_holiday',
    description: 'National holiday — dedicated focus block or quiet weekend planning opportunity.',
  },
];

export function getUpcomingPlanningOpportunities(referenceDate: Date = new Date()): PlanningOpportunity[] {
  const refTime = referenceDate.getTime();
  // Filter for opportunities occurring within next 180 days
  return RECOGNIZED_PLANNING_CATALOG.filter((op) => {
    const opDate = new Date(op.dateStr);
    const diffDays = (opDate.getTime() - refTime) / (1000 * 60 * 60 * 24);
    return diffDays >= -2 && diffDays <= 180;
  });
}
