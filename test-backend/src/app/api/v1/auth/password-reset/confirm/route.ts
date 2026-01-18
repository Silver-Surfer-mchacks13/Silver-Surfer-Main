import { NextRequest, NextResponse } from 'next/server';
import { passwordResetService } from '@/lib/services/auth/password-reset-service';
import { ConfirmPasswordResetRequestSchema } from '@/lib/types/auth';
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
 * /api/v1/auth/password-reset/confirm:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm password reset
 *     description: Reset password using a valid reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               newPassword:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 100
 *                 description: New password (must meet strength requirements)
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid token or password validation failed
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
    const validation = ConfirmPasswordResetRequestSchema.safeParse(body);

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

    const result = await passwordResetService.performPasswordResetRequest(
      validation.data.token,
      validation.data.newPassword
    );

    if (!result.isSuccess) {
      return NextResponse.json<ErrorResponse>(
        {
          message: result.errorMessage || 'Invalid or expired token',
          errorCode: 'PASSWORD_RESET_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed';

    return NextResponse.json<ErrorResponse>(
      {
        message,
        errorCode: 'PASSWORD_RESET_FAILED',
      },
      { status: 400 }
    );
  }
}
