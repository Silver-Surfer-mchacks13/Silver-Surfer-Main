import { NextRequest, NextResponse } from 'next/server';
import { passwordResetService } from '@/lib/services/auth/password-reset-service';
import { PasswordResetRequestSchema } from '@/lib/types/auth';
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
 * /api/auth/password-reset/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Request a password reset token. Always returns 200 for security (doesn't reveal if email exists).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Request processed (always returns 200 for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = PasswordResetRequestSchema.safeParse(body);

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

    // Create password reset request (silently fails if email doesn't exist for security)
    await passwordResetService.createPasswordResetRequest(validation.data.email);

    // Always return 200 for security (don't reveal if email exists)
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    // Even on error, return 200 for security
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
}
