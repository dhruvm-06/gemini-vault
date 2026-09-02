import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  };
}

/**
 * Express middleware to verify Firebase ID tokens.
 * Extracts the user identity strictly from the cryptographically verified JWT,
 * preventing cross-user access and rejecting unauthenticated or spoofed requests.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected Bearer <Firebase_ID_Token>.',
    });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();

  if (!idToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Empty Firebase ID token provided.',
    });
    return;
  }

  try {
    // Cryptographically verify ID token against Google's public keys
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Attach verified identity strictly derived from the decoded token
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
    };

    next();
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Token verification failed';
    console.warn(`[requireAuth] Token verification failed: ${errMessage}`);
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired Firebase ID token.',
    });
  }
}
