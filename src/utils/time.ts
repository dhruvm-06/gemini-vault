/**
 * Normalized timestamp helper for Cloud Firestore and client state.
 * Safely converts string dates, epoch numbers, Date objects, and
 * Firestore Timestamp instances / serialized objects into epoch milliseconds.
 */
export function toTimestamp(value: unknown): number {
  if (!value) return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof candidate.toDate === 'function') {
      try {
        return candidate.toDate().getTime();
      } catch {
        // Fall through
      }
    }

    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number') {
      return seconds * 1000;
    }
  }

  return 0;
}

/**
 * Returns an ISO date-time string from a flexible timestamp input,
 * or null if invalid.
 */
export function toIsoString(value: unknown): string | null {
  const ms = toTimestamp(value);
  if (!ms) return null;
  return new Date(ms).toISOString();
}
