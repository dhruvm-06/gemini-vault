import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * ARCHITECTURAL NOTICE — SINGLE-INSTANCE RATE LIMITER BOUNDARY:
 *
 * This rate limiter operates strictly process-local in memory. It is NOT globally
 * synchronized across multiple horizontal Cloud Run instances or container replicas.
 *
 * It is designed as a defense-in-depth protection layer against:
 * 1. Accidental client-side runaway request loops.
 * 2. Rapid manual spamming of expensive Vertex AI endpoints.
 * 3. Local automated script abuse on a per-instance basis.
 *
 * It does NOT serve as complete distributed abuse protection across multi-instance
 * deployments (which would require external shared caching such as Google Cloud Armor,
 * Memorystore Redis, or Firebase App Check).
 */

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  endpointName: string;
  message?: string;
}

interface ClientBucket {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, endpointName, message } = options;
  const store = new Map<string, ClientBucket>();

  // Periodically sweep expired buckets to prevent unbounded memory growth.
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store.entries()) {
      if (bucket.resetTime <= now) {
        store.delete(key);
      }
    }
  }, Math.max(windowMs, 30000));

  // unref ensures this background cleanup does not hold the Node.js process open on exit
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  return function rateLimitMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const now = Date.now();

    // Prefer verified Firebase UID after authentication; fallback to client IP
    const clientId = req.user?.uid || req.ip || req.socket?.remoteAddress || 'unknown-client';
    const key = `${endpointName}:${clientId}`;

    let bucket = store.get(key);

    if (!bucket || bucket.resetTime <= now) {
      bucket = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, max - bucket.count);
    const resetTimeSeconds = Math.ceil(bucket.resetTime / 1000);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000));

    // Standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (bucket.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: 'Too Many Requests',
        message:
          message ||
          'Rate limit exceeded for this operation. Please wait a moment before trying again.',
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for expensive AI endpoints.
 * Limits are configurable through environment variables with sensible defaults.
 */
const DEFAULT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute

export const chatRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_CHAT_MAX) || 25,
  endpointName: 'ai_chat',
  message: 'You have reached the limit for reflection messages. Please take a breath and try again shortly.',
});

export const extractRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_EXTRACT_MAX) || 15,
  endpointName: 'ai_extract',
  message: 'Memory extraction rate limit exceeded. Please wait a moment before extracting again.',
});

export const askRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_ASK_MAX) || 20,
  endpointName: 'ai_ask',
  message: 'Ask My Vault rate limit reached. Please wait a moment before asking another question.',
});

export const signalsRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_SIGNALS_MAX) || 15,
  endpointName: 'ai_signals',
  message: 'Vault Signals rate limit reached. Please wait a moment before refreshing signals.',
});

export const momentsRateLimiter = createRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_MOMENTS_MAX) || 15,
  endpointName: 'ai_moments',
  message: 'Moments synthesis rate limit reached. Please wait a moment before creating another moment.',
});
