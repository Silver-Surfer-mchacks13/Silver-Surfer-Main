import { randomBytes } from 'crypto';
import { supabase, table, type RefreshToken } from '@/lib/db/supabase';

export class RefreshTokenService {
  private readonly expirationDays: number;

  constructor() {
    this.expirationDays = parseInt(
      process.env.JWT_REFRESH_TOKEN_EXPIRATION_DAYS || '30',
      10
    );
  }

  /**
   * Generate a new refresh token for a user
   * Implements token rotation - revokes all existing tokens for the user
   */
  async generateRefreshTokenAsync(userId: string): Promise<string> {
    // Revoke all existing refresh tokens for this user (token rotation)
    await this.revokeAllUserTokensAsync(userId, 'New token issued');

    // Generate secure random token (64 bytes = 512 bits)
    const tokenBytes = randomBytes(64);
    const token = tokenBytes.toString('base64');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    // Insert new refresh token (matching C# RefreshToken model)
    const { error } = await table('refresh_tokens')
      .insert({
        UserId: userId,
        token,
        ExpiresAt: expiresAt.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to create refresh token: ${error.message}`);
    }

    return token;
  }

  /**
   * Get a refresh token by token string
   */
  async getRefreshTokenAsync(token: string): Promise<RefreshToken | null> {
    const { data, error } = await table('refresh_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get refresh token: ${error.message}`);
    }

    return data as RefreshToken;
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshTokenAsync(token: string, reason?: string): Promise<void> {
    const refreshToken = await this.getRefreshTokenAsync(token);
    if (refreshToken && !refreshToken.RevokedAt) {
      const { error } = await table('refresh_tokens')
        .update({
          RevokedAt: new Date().toISOString(),
          RevocationReason: reason || null,
        })
        .eq('id', refreshToken.id);

      if (error) {
        throw new Error(`Failed to revoke refresh token: ${error.message}`);
      }
    }
  }

  /**
   * Revoke all active refresh tokens for a user
   */
  async revokeAllUserTokensAsync(userId: string, reason?: string): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await table('refresh_tokens')
      .update({
        RevokedAt: now,
        RevocationReason: reason || null,
      })
      .eq('UserId', userId)
      .is('RevokedAt', null)
      .gt('ExpiresAt', now); // Only revoke non-expired tokens

    if (error) {
      throw new Error(`Failed to revoke user tokens: ${error.message}`);
    }
  }

  /**
   * Check if a refresh token is valid (not revoked and not expired)
   */
  async isTokenValidAsync(token: string): Promise<boolean> {
    const refreshToken = await this.getRefreshTokenAsync(token);

    if (!refreshToken) {
      return false;
    }

    // Check if revoked
    if (refreshToken.RevokedAt) {
      return false;
    }

    // Check if expired
    const expiresAt = new Date(refreshToken.ExpiresAt);
    if (expiresAt <= new Date()) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const refreshTokenService = new RefreshTokenService();
