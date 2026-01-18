import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth/auth-service';
import { LoginRequestSchema } from '@/lib/types/auth';
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
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate an existing user
 *     description: Login with email and password credentials
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Login successful
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
 *         description: Invalid request data
 *       401:
 *         description: Invalid credentials
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
    const validation = LoginRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<ErrorResponse>(
        {
          message: 'Invalid request data',
          errors: validation.error.errors.reduce((acc, err) => {
            const path = err.path.join('.');
            if (!acc[path]) acc[path] = [];
            acc[path].push(err.message);
            return acc;
          }, {} as Record<string, string[]>),
        },
        { status: 400 }
      );
    }

    const response = await authService.loginAsync(validation.data);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid email or password';

    return NextResponse.json<ErrorResponse>(
      {
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      },
      { status: 401 }
    );
  }
}
