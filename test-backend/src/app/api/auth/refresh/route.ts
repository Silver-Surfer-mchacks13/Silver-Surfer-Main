import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth/auth-service';
import { RefreshTokenRequestSchema } from '@/lib/types/auth';
import type { ErrorResponse } from '@/lib/types/auth';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Get a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to use
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 accessTokenExpiresAt:
 *                   type: string
 *                   format: date-time
 *                 refreshTokenExpiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid or expired refresh token
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
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = RefreshTokenRequestSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      if (validation.error && validation.error.issues) {
        validation.error.issues.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });
      }

      return NextResponse.json<ErrorResponse>(
        {
          message: 'Invalid request data',
          errors,
        },
        { status: 400 }
      );
    }

    const response = await authService.refreshTokenAsync(validation.data.refreshToken);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid or expired refresh token';

    return NextResponse.json<ErrorResponse>(
      {
        message,
        errorCode: 'INVALID_REFRESH_TOKEN',
      },
      { status: 400 }
    );
  }
}
