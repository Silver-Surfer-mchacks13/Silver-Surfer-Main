import { OAuth2Client } from 'google-auth-library';
import type { AuthProvider } from '@/lib/db/supabase';

export interface TokenValidationResult {
  userId: string;
  email: string;
}

export interface ITokenValidationService {
  validateIdTokenAsync(idToken: string, expectedClientId: string): Promise<TokenValidationResult>;
  validateAuthorizationCodeAsync(
    code: string,
    redirectUri: string,
    expectedClientId: string,
    clientSecret?: string
  ): Promise<TokenValidationResult>;
}

/**
 * Google OAuth token validation service
 * Uses ID token flow (not authorization code flow)
 */
export class GoogleTokenValidationService implements ITokenValidationService {
  async validateIdTokenAsync(
    idToken: string,
    expectedClientId: string
  ): Promise<TokenValidationResult> {
    if (!idToken || idToken.trim().length === 0) {
      throw new Error('ID token is required');
    }

    if (!expectedClientId || expectedClientId.trim().length === 0) {
      throw new Error('Google Client ID is not configured');
    }

    try {
      const client = new OAuth2Client(expectedClientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: expectedClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid Google ID token payload');
      }

      if (!payload.sub) {
        throw new Error('Google ID token missing user ID');
      }

      if (!payload.email) {
        throw new Error('Google ID token missing email');
      }

      return {
        userId: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid Google ID token: ${error.message}`);
      }
      throw new Error('Failed to validate Google ID token');
    }
  }

  async validateAuthorizationCodeAsync(): Promise<TokenValidationResult> {
    throw new Error('Google OAuth uses ID token flow, not authorization code flow');
  }
}

/**
 * Microsoft OAuth token validation service
 * Uses ID token flow
 */
export class MicrosoftTokenValidationService implements ITokenValidationService {
  async validateIdTokenAsync(
    idToken: string,
    expectedClientId: string
  ): Promise<TokenValidationResult> {
    if (!idToken || idToken.trim().length === 0) {
      throw new Error('ID token is required');
    }

    if (!expectedClientId || expectedClientId.trim().length === 0) {
      throw new Error('Microsoft Client ID is not configured');
    }

    // For Microsoft, we need to validate the JWT manually
    // Microsoft tokens are JWTs that can be validated using their public keys
    // TODO: In production, fetch and validate against Microsoft's public keys from:
    // https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
    // For now, we decode and check basic structure - this should be enhanced for production
    
    try {
      // Decode the JWT (without verification for now - should verify in production)
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        Buffer.from(base64, 'base64')
          .toString()
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);

      // Verify audience matches expected client ID
      if (payload.aud !== expectedClientId) {
        throw new Error('Microsoft ID token audience mismatch');
      }

      if (!payload.sub) {
        throw new Error('Microsoft ID token missing user ID');
      }

      if (!payload.email) {
        throw new Error('Microsoft ID token missing email');
      }

      return {
        userId: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid Microsoft ID token: ${error.message}`);
      }
      throw new Error('Failed to validate Microsoft ID token');
    }
  }

  async validateAuthorizationCodeAsync(): Promise<TokenValidationResult> {
    throw new Error('Microsoft OAuth uses ID token flow, not authorization code flow');
  }
}

/**
 * GitHub OAuth token validation service
 * Uses authorization code flow (exchanges code for access token, then fetches user info)
 */
export class GitHubTokenValidationService implements ITokenValidationService {
  async validateIdTokenAsync(): Promise<TokenValidationResult> {
    throw new Error('GitHub OAuth uses authorization code flow, not ID token flow');
  }

  async validateAuthorizationCodeAsync(
    code: string,
    redirectUri: string,
    expectedClientId: string,
    clientSecret?: string
  ): Promise<TokenValidationResult> {
    if (!code || code.trim().length === 0) {
      throw new Error('Authorization code is required');
    }

    if (!redirectUri || redirectUri.trim().length === 0) {
      throw new Error('Redirect URI is required for authorization code flow');
    }

    if (!expectedClientId || expectedClientId.trim().length === 0) {
      throw new Error('GitHub Client ID is not configured');
    }

    if (!clientSecret || clientSecret.trim().length === 0) {
      throw new Error('GitHub Client Secret is not configured');
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: expectedClientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for access token');
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`GitHub token exchange error: ${tokenData.error_description || tokenData.error}`);
      }

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error('No access token received from GitHub');
      }

      // Fetch user information using access token
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user information from GitHub');
      }

      const userData = await userResponse.json();

      if (!userData.id) {
        throw new Error('GitHub user data missing user ID');
      }

      if (!userData.email) {
        throw new Error('GitHub user data missing email');
      }

      return {
        userId: userData.id.toString(),
        email: userData.email,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`GitHub OAuth validation failed: ${error.message}`);
      }
      throw new Error('Failed to validate GitHub authorization code');
    }
  }
}

/**
 * Factory to get the appropriate token validation service for a provider
 */
export class TokenValidationServiceFactory {
  private readonly googleService: GoogleTokenValidationService;
  private readonly microsoftService: MicrosoftTokenValidationService;
  private readonly githubService: GitHubTokenValidationService;

  constructor() {
    this.googleService = new GoogleTokenValidationService();
    this.microsoftService = new MicrosoftTokenValidationService();
    this.githubService = new GitHubTokenValidationService();
  }

  getValidator(provider: AuthProvider): ITokenValidationService {
    switch (provider) {
      case 'Google':
        return this.googleService;
      case 'Microsoft':
        return this.microsoftService;
      case 'GitHub':
        return this.githubService;
      default:
        throw new Error(`OAuth provider '${provider}' is not supported`);
    }
  }
}

// Export singleton instance
export const tokenValidationServiceFactory = new TokenValidationServiceFactory();
