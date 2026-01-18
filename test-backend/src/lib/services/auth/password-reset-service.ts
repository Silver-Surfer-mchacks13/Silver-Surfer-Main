import { randomBytes } from 'crypto';
import { supabase, table, type PasswordResetRequest } from '@/lib/db/supabase';
import { passwordValidator } from './password-validator';
import bcrypt from 'bcrypt';

export interface PasswordResetResult {
  isSuccess: boolean;
  errorMessage?: string;
}

export class PasswordResetService {
  /**
   * Create a password reset request for a user
   * Returns silently if email doesn't exist (security - don't reveal if email exists)
   */
  async createPasswordResetRequest(email: string): Promise<void> {
    const emailProcessed = email.trim().toLowerCase();

    // Only allow password reset for Local provider users
    const { data: user, error: userError } = await table('users')
      .select('id')
      .eq('email', emailProcessed)
      .eq('provider', 'Local')
      .single();

    if (userError || !user) {
      // Don't reveal if email exists for security
      return;
    }

    // Generate secure random token (32 bytes = 256 bits)
    const tokenBytes = randomBytes(32);
    const token = tokenBytes.toString('base64');

    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    // Insert password reset request (matching C# PasswordResetRequest model)
    const { error } = await table('password_reset_requests')
      .insert({
        UserId: user.id,
        token,
        ExpiresAt: expiresAt.toISOString(),
      });

    if (error) {
      // Log error but don't reveal to user
      console.error('Failed to create password reset request:', error);
      return;
    }

    // TODO: Send email with reset link (deferred for now)
    // const resetUrl = `${frontendBaseUrl}/auth/password-reset?token=${encodeURIComponent(token)}`;
    // await emailService.sendPasswordResetEmailAsync(email, resetUrl);
  }

  /**
   * Perform password reset with token and new password
   */
  async performPasswordResetRequest(
    token: string,
    newPassword: string
  ): Promise<PasswordResetResult> {
    // Validate password first
    const validation = passwordValidator.validatePassword(newPassword);
    if (!validation.isValid) {
      return {
        isSuccess: false,
        errorMessage: validation.errorMessage || 'Invalid password',
      };
    }

    // Get password reset request
    const { data: prr, error: prrError } = await table('password_reset_requests')
      .select('*, users(*)')
      .eq('token', token)
      .single();

    if (prrError || !prr) {
      return {
        isSuccess: false,
        errorMessage: 'Invalid or expired reset token',
      };
    }

    // Check if expired
    const expiresAt = new Date(prr.ExpiresAt);
    if (expiresAt < new Date()) {
      // Delete expired token
      await table('password_reset_requests')
        .delete()
        .eq('id', prr.id);

      return {
        isSuccess: false,
        errorMessage: 'Reset token has expired',
      };
    }

    // Get user from the relation
    const user = (prr as any).users;
    if (!user) {
      return {
        isSuccess: false,
        errorMessage: 'User not found',
      };
    }

    // Only allow password reset for Local provider users
    if (user.provider !== 'Local') {
      // Delete the request
      await table('password_reset_requests')
        .delete()
        .eq('id', prr.id);

      return {
        isSuccess: false,
        errorMessage: 'Password reset is not available for this account type',
      };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password (matching C# User model)
    const { error: updateError } = await table('users')
      .update({
        PasswordHash: passwordHash,
        UpdatedAt: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      return {
        isSuccess: false,
        errorMessage: 'Failed to update password',
      };
    }

    // Delete the password reset request
    await table('password_reset_requests')
      .delete()
      .eq('id', prr.id);

    return { isSuccess: true };
  }
}

// Export singleton instance
export const passwordResetService = new PasswordResetService();
