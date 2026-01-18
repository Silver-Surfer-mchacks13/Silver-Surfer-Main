import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/utils/auth';

/**
 * Middleware to protect routes that require authentication
 * Returns 401 if token is missing or invalid
 */
export function requireAuthMiddleware(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        message: 'Authorization token required',
        errorCode: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  try {
    verifyToken(token);
    return null; // Token is valid, continue
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Invalid or expired token',
        errorCode: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
}
