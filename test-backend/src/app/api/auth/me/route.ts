import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth/auth-service';
import { jwtTokenService } from '@/lib/services/auth/jwt-service';
import type { ErrorResponse, UserDto } from '@/lib/types/auth';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user information
 *     description: Returns the authenticated user's information. Requires valid JWT token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 email:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 errorCode:
 *                   type: string
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 errorCode:
 *                   type: string
 */
export async function GET(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'Authorization token required',
          errorCode: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token and extract user ID
    let userId: string;
    try {
      const payload = jwtTokenService.verifyToken(token);
      userId = payload.sub;
    } catch (error) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'Invalid or expired token',
          errorCode: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    // Get user information
    const user = await authService.getUserByIdAsync(userId);
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'User not found',
          errorCode: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<UserDto>(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user information';

    return NextResponse.json<ErrorResponse>(
      {
        message,
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
