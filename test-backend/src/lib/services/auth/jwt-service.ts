import jwt from 'jsonwebtoken';
import type { User } from '@/lib/db/supabase';

interface JwtPayload {
  sub: string; // User ID
  email: string;
  jti: string; // JWT ID
  token_type: 'access';
  iat?: number;
  exp?: number;
}

export class JwtTokenService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenExpirationMinutes: number;

  constructor() {
    // Generate a default secret if not provided (for development only)
    this.secret = process.env.JWT_SECRET || this.generateDefaultSecret();
    this.issuer = process.env.JWT_ISSUER || 'SilverSurferAPI';
    this.audience = process.env.JWT_AUDIENCE || 'SilverSurferClient';
    this.accessTokenExpirationMinutes = parseInt(
      process.env.JWT_ACCESS_TOKEN_EXPIRATION_MINUTES || '15',
      10
    );

    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
  }

  private generateDefaultSecret(): string {
    // Generate a random secret for development (not secure for production!)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    console.warn('⚠️  Using auto-generated JWT_SECRET. Set JWT_SECRET in .env for production!');
    return 'dev-secret-' + crypto.randomUUID() + '-' + Date.now();
  }

  /**
   * Generate a JWT access token for a user
   * @param user The user to generate a token for
   * @returns The JWT token and its JTI (JWT ID)
   */
  generateAccessToken(user: User): { token: string; jti: string } {
    const jti = crypto.randomUUID();
    const expiresIn = this.accessTokenExpirationMinutes * 60; // Convert to seconds

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti,
      token_type: 'access',
    };

    const token = jwt.sign(payload, this.secret, {
      issuer: this.issuer,
      audience: this.audience,
      expiresIn,
    });

    return { token, jti };
  }

  /**
   * Verify and decode a JWT token
   * @param token The JWT token to verify
   * @returns The decoded payload if valid
   * @throws Error if token is invalid
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as JwtPayload;

      if (decoded.token_type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid token: ${error.message}`);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      throw error;
    }
  }

  /**
   * Extract user ID from a JWT token without full verification
   * (Useful for optional auth scenarios)
   */
  extractUserId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload | null;
      return decoded?.sub || null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const jwtTokenService = new JwtTokenService();
