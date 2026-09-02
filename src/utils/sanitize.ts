/**
 * Recursively strips 'undefined' properties from plain objects and arrays
 * prior to Firestore write operations, preventing NoSQL driver crashes.
 */
export function sanitizeFirestorePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as unknown as T;
  }

  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }

  if (typeof input === 'object' && !(input instanceof Date)) {
    // Preserve Firestore FieldValues / Timestamps or custom class instances if present
    if (input.constructor && input.constructor.name !== 'Object') {
      return input;
    }

    const cleanObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (val !== undefined) {
        cleanObj[key] = sanitizeFirestorePayload(val);
      }
    }
    return cleanObj as T;
  }

  return input;
}
