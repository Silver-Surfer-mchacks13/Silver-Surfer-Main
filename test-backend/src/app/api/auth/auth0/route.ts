import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth/auth-service';
import { Auth0ProfileRequestSchema } from '@/lib/types/auth';
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
 * /api/auth/auth0:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate with Auth0 profile
 *     description: Login or register using Auth0 user profile data (separate from OAuth endpoint)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, email_verified, sub]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: "user@example.com"
 *               email_verified:
 *                 type: boolean
 *                 description: Whether the email is verified
 *                 example: true
 *               sub:
 *                 type: string
 *                 description: Provider user ID (e.g., "google-oauth2|...")
 *                 example: "google-oauth2|110591699196166077368"
 *               name:
 *                 type: string
 *                 description: Full name
 *                 example: "John Doe"
 *               given_name:
 *                 type: string
 *                 description: First name
 *                 example: "John"
 *               family_name:
 *                 type: string
 *                 description: Last name
 *                 example: "Doe"
 *               nickname:
 *                 type: string
 *                 description: User nickname
 *                 example: "johndoe"
 *               picture:
 *                 type: string
 *                 format: uri
 *                 description: Profile picture URL
 *                 example: "https://example.com/picture.jpg"
 *               updated_at:
 *                 type: string
 *                 format: date-time
 *                 description: Last update timestamp
 *                 example: "2026-01-18T09:02:33.218Z"
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
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
 *         description: Invalid request data
 *       401:
 *         description: Email not verified
 *       409:
 *         description: Account conflict
 */
export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'Invalid request data',
          errors: { body: ['Invalid JSON'] },
        },
        { status: 400 }
      );
    }

    const validation = Auth0ProfileRequestSchema.safeParse(body);

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

    const profile = validation.data;

    // Verify email is verified
    if (!profile.email_verified) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'Email is not verified',
          errorCode: 'EMAIL_NOT_VERIFIED',
        },
        { status: 401 }
      );
    }

    // Authenticate with Auth0 profile
    const response = await authService.loginWithAuth0ProfileAsync({
      email: profile.email,
      sub: profile.sub,
    });

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth0 authentication failed';

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
        errorCode: 'AUTH0_AUTH_FAILED',
      },
      {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
