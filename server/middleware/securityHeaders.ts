import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers and Content Security Policy Middleware for Gemini Vault.
 *
 * Configured specifically to support:
 * 1. Firebase Authentication with Google Sign-In popups (requires same-origin-allow-popups COOP).
 * 2. Profile images from Google Accounts (lh3.googleusercontent.com with COEP disabled/unsafe-none).
 * 3. Vite development server (HMR WebSockets and evaluation in dev mode).
 * 4. Hardened production CSP (narrow origins, no broad wildcards, no unsafe-eval).
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || 'gemini-vault-507219.firebaseapp.com';

  // 1. Fundamental HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 2. Cross-Origin Policies
  // COOP MUST be same-origin-allow-popups so Firebase Auth's popup (accounts.google.com / authDomain)
  // can communicate credentials back to the opener window.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // COEP must remain disabled (or unsafe-none) to avoid blocking external cross-origin images
  // such as user Google profile pictures (lh3.googleusercontent.com).
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

  // 3. Environment-Differentiated Content Security Policy (CSP)
  const baseDirectives = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    `frame-src 'self' https://accounts.google.com https://${authDomain}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (!isProduction) {
    // Development CSP: accommodates Vite HMR WebSockets and Vite source maps
    const devDirectives = [
      ...baseDirectives,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      `connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:* ws://0.0.0.0:* https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://accounts.google.com https://${authDomain}`,
    ];
    res.setHeader('Content-Security-Policy', devDirectives.join('; '));
  } else {
    // Production CSP: strictly hardened, removes unsafe-eval and dev localhost connect-src,
    // and narrowly scopes Google/Firebase origins to required endpoints.
    const prodDirectives = [
      ...baseDirectives,
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
      `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://accounts.google.com https://${authDomain}`,
    ];
    res.setHeader('Content-Security-Policy', prodDirectives.join('; '));
  }

  next();
}
