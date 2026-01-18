import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth/auth-service';
import { OAuthLoginRequestSchema } from '@/lib/types/auth';
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
 * /api/auth/oauth:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate with OAuth provider
 *     description: Login or register using OAuth provider (Google, Microsoft, or GitHub)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [Google, Microsoft, GitHub]
 *               idToken:
 *                 type: string
 *                 description: ID token for Google/Microsoft (ID token flow)
 *               authorizationCode:
 *                 type: string
 *                 description: Authorization code for GitHub (authorization code flow)
 *               redirectUri:
 *                 type: string
 *                 description: Redirect URI (required for authorization code flow)
 *     responses:
 *       200:
 *         description: OAuth login successful
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
 *         description: Invalid request
 *       401:
 *         description: Token validation failed
 *       409:
 *         description: Account conflict
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = OAuthLoginRequestSchema.safeParse(body);

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

    const response = await authService.loginWithOAuthAsync(validation.data);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth authentication failed';
    
    if (message.includes('not configured') || message.includes('required')) {
      return NextResponse.json<ErrorResponse>(
        {
          message,
          errorCode: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (message.includes('validation failed') || message.includes('Invalid')) {
      return NextResponse.json<ErrorResponse>(
        {
          message,
          errorCode: 'TOKEN_VALIDATION_FAILED',
        },
        { status: 401 }
      );
    }

    if (message.includes('already exists') || message.includes('conflict')) {
      return NextResponse.json<ErrorResponse>(
        {
          message,
          errorCode: 'ACCOUNT_CONFLICT',
        },
        { status: 409 }
      );
    }

    return NextResponse.json<ErrorResponse>(
      {
        message,
        errorCode: 'OAUTH_FAILED',
      },
      { status: 400 }
    );
  }
}
