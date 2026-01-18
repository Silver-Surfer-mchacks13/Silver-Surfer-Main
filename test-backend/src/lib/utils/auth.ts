import { NextRequest } from 'next/server';
import { jwtTokenService } from '@/lib/services/auth/jwt-service';

/**
 * Extract JWT token from request Authorization header
 */
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify JWT token and return payload
 * @throws Error if token is invalid
 */
export function verifyToken(token: string) {
  return jwtTokenService.verifyToken(token);
}

/**
 * Extract user ID from JWT token (without full verification)
 * Useful for optional auth scenarios
 */
export function getUserIdFromToken(token: string): string | null {
  return jwtTokenService.extractUserId(token);
}

/**
 * Require authentication - throws error if token is missing or invalid
 * Use this in route handlers that require authentication
 */
export function requireAuth(req: NextRequest): { userId: string; email: string } {
  const token = getTokenFromRequest(req);
  if (!token) {
    throw new Error('Authorization token required');
  }

  try {
    const payload = verifyToken(token);
    return {
      userId: payload.sub,
      email: payload.email,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    throw new Error('Invalid token');
  }
}

/**
 * Optional authentication - returns user info if token is present and valid
 * Use this for routes that work with or without authentication
 */
export function optionalAuth(req: NextRequest): { userId: string; email: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    return {
      userId: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
