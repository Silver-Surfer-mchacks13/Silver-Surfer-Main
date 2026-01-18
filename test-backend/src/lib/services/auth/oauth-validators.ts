import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

      // Verify email is verified (if claim exists)
      if (payload.email_verified === false) {
        throw new Error('Google email is not verified');
      }

      return {
        userId: payload.sub,
        email: payload.email.toLowerCase(),
      };
    } catch (error) {
      if (error instanceof Error) {
        // Provide more specific error messages
        if (error.message.includes('expired')) {
          throw new Error('Google ID token has expired');
        }
        if (error.message.includes('audience')) {
          throw new Error('Google ID token audience mismatch');
        }
        if (error.message.includes('signature')) {
          throw new Error('Google ID token signature validation failed');
        }
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
 * Uses ID token flow with proper JWT signature verification
 */
export class MicrosoftTokenValidationService implements ITokenValidationService {
  private jwksCache: Map<string, { keys: any[]; expiresAt: number }> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Fetch Microsoft's JWKS (JSON Web Key Set) for token verification
   */
  private async fetchJWKS(tenant: string): Promise<any[]> {
    const cacheKey = tenant;
    const cached = this.jwksCache.get(cacheKey);

    // Return cached keys if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    try {
      const jwksUrl = `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
      const response = await fetch(jwksUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch Microsoft JWKS: ${response.statusText}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error('Invalid JWKS format from Microsoft');
      }

      // Cache the keys with expiration
      this.jwksCache.set(cacheKey, {
        keys: jwks.keys,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return jwks.keys;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Microsoft JWKS: ${error.message}`);
      }
      throw new Error('Failed to fetch Microsoft JWKS');
    }
  }

  /**
   * Convert JWK to PEM format for jwt.verify
   */
  private jwkToPem(jwk: any): string {
    if (jwk.kty !== 'RSA') {
      throw new Error(`Unsupported key type: ${jwk.kty}`);
    }

    // Convert base64url to Buffer
    const modulus = Buffer.from(jwk.n, 'base64url');
    const exponent = Buffer.from(jwk.e, 'base64url');

    // Create RSA public key using Node.js crypto
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });

    // Export as PEM
    return publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
  }

  /**
   * Get the public key from JWKS for a specific key ID
   */
  private async getPublicKey(kid: string, tenant: string): Promise<string> {
    const jwks = await this.fetchJWKS(tenant);
    const key = jwks.find((k: any) => k.kid === kid);

    if (!key) {
      throw new Error(`Key with kid '${kid}' not found in Microsoft JWKS`);
    }

    // For Microsoft, keys are typically in JWK format
    // We'll use a simpler approach: decode the token header to get the key
    // and verify using the JWKS directly
    return this.jwkToPem(key);
  }

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

    try {
      // Get tenant ID from environment (defaults to 'common')
      const tenant = process.env.OAUTH_MICROSOFT_TENANT_ID || 'common';

      // Decode token header to get key ID (kid)
      const decodedHeader = jwt.decode(idToken, { complete: true });
      if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new Error('Invalid Microsoft ID token format');
      }

      const header = decodedHeader.header;
      if (!header.kid) {
        throw new Error('Microsoft ID token missing key ID (kid)');
      }

      // Fetch JWKS and get the public key
      const jwks = await this.fetchJWKS(tenant);
      const key = jwks.find((k: any) => k.kid === header.kid);

      if (!key) {
        throw new Error(`Key with kid '${header.kid}' not found in Microsoft JWKS`);
      }

      // Verify the token signature and decode
      // Microsoft tokens use RS256 algorithm
      // We'll verify using the issuer and audience
      const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
      
      // Decode and verify the token
      // Note: jsonwebtoken doesn't directly support JWK, so we'll verify manually
      // For production, consider using 'jose' library which has better JWK support
      const decoded = jwt.decode(idToken, { complete: true });
      
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid Microsoft ID token format');
      }

      const payload = decoded.payload as any;

      // Verify issuer
      if (payload.iss !== issuer) {
        throw new Error(`Microsoft ID token issuer mismatch. Expected: ${issuer}, Got: ${payload.iss}`);
      }

      // Verify audience
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(expectedClientId)) {
        throw new Error(`Microsoft ID token audience mismatch. Expected: ${expectedClientId}, Got: ${payload.aud}`);
      }

      // Verify expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Microsoft ID token has expired');
      }

      // Verify not before
      if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
        throw new Error('Microsoft ID token is not yet valid');
      }

      // Extract required fields
      if (!payload.sub) {
        throw new Error('Microsoft ID token missing user ID (sub)');
      }

      // Email might be in 'email' or 'preferred_username' claim
      // Also check 'upn' (User Principal Name) for Microsoft accounts
      const email = payload.email || payload.preferred_username || payload.upn;
      if (!email) {
        throw new Error('Microsoft ID token missing email, preferred_username, or upn');
      }

      // Verify email is verified if claim exists
      if (payload.email_verified === false) {
        throw new Error('Microsoft email is not verified');
      }

      // Verify signature using the public key from JWKS
      try {
        // Convert JWK to PEM and verify
        const publicKeyPem = this.jwkToPem(key);
        jwt.verify(idToken, publicKeyPem, {
          algorithms: ['RS256'],
          issuer,
          audience: expectedClientId,
        });
      } catch (verifyError) {
        if (verifyError instanceof jwt.JsonWebTokenError) {
          throw new Error(`Microsoft ID token signature verification failed: ${verifyError.message}`);
        }
        if (verifyError instanceof jwt.TokenExpiredError) {
          throw new Error('Microsoft ID token has expired');
        }
        if (verifyError instanceof jwt.NotBeforeError) {
          throw new Error('Microsoft ID token is not yet valid');
        }
        throw verifyError;
      }

      return {
        userId: payload.sub,
        email: email.toLowerCase(),
      };
    } catch (error) {
      if (error instanceof Error) {
        // Don't expose internal errors, provide user-friendly messages
        if (error.message.includes('expired')) {
          throw new Error('Microsoft ID token has expired');
        }
        if (error.message.includes('signature')) {
          throw new Error('Microsoft ID token signature validation failed');
        }
        if (error.message.includes('audience') || error.message.includes('issuer')) {
          throw new Error('Microsoft ID token validation failed: invalid audience or issuer');
        }
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
        const errorText = await userResponse.text();
        throw new Error(`Failed to fetch user information from GitHub: ${userResponse.status} ${errorText}`);
      }

      const userData = await userResponse.json();

      if (!userData.id) {
        throw new Error('GitHub user data missing user ID');
      }

      // GitHub may not return email in user endpoint if it's not public
      // Try to fetch from emails endpoint
      let email = userData.email;
      
      if (!email) {
        try {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (emailsResponse.ok) {
            const emailsData = await emailsResponse.json();
            if (Array.isArray(emailsData) && emailsData.length > 0) {
              // Find primary email, or use first verified email, or first email
              const primaryEmail = emailsData.find((e: any) => e.primary && e.verified);
              const verifiedEmail = emailsData.find((e: any) => e.verified);
              email = primaryEmail?.email || verifiedEmail?.email || emailsData[0]?.email;
            }
          }
        } catch (emailFetchError) {
          // If email fetch fails, we'll throw error below
        }
      }

      if (!email) {
        throw new Error('GitHub user email is not available. Please ensure your GitHub account has a public email or grant user:email scope.');
      }

      return {
        userId: userData.id.toString(),
        email: email.toLowerCase(),
      };
    } catch (error) {
      if (error instanceof Error) {
        // Provide more specific error messages
        if (error.message.includes('email')) {
          throw error; // Re-throw email-related errors as-is
        }
        if (error.message.includes('token exchange')) {
          throw new Error(`GitHub token exchange failed: ${error.message}`);
        }
        if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error(`GitHub API request failed: ${error.message}`);
        }
        throw new Error(`GitHub OAuth validation failed: ${error.message}`);
      }
      throw new Error('Failed to validate GitHub authorization code');
    }
  }
}

/**
 * Auth0 OAuth token validation service
 * Uses ID token flow with JWKS signature verification
 */
export class Auth0TokenValidationService implements ITokenValidationService {
  private jwksCache: Map<string, { keys: any[]; expiresAt: number }> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Fetch Auth0's JWKS (JSON Web Key Set) for token verification
   */
  private async fetchJWKS(domain: string): Promise<any[]> {
    const cacheKey = domain;
    const cached = this.jwksCache.get(cacheKey);

    // Return cached keys if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    try {
      const jwksUrl = `https://${domain}/.well-known/jwks.json`;
      const response = await fetch(jwksUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch Auth0 JWKS: ${response.statusText}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error('Invalid JWKS format from Auth0');
      }

      // Cache the keys with expiration
      this.jwksCache.set(cacheKey, {
        keys: jwks.keys,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return jwks.keys;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Auth0 JWKS: ${error.message}`);
      }
      throw new Error('Failed to fetch Auth0 JWKS');
    }
  }

  /**
   * Convert JWK to PEM format for jwt.verify
   */
  private jwkToPem(jwk: any): string {
    if (jwk.kty !== 'RSA') {
      throw new Error(`Unsupported key type: ${jwk.kty}`);
    }

    // Create RSA public key using Node.js crypto
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });

    // Export as PEM
    return publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
  }

  async validateIdTokenAsync(
    idToken: string,
    expectedClientId: string
  ): Promise<TokenValidationResult> {
    if (!idToken || idToken.trim().length === 0) {
      throw new Error('ID token is required');
    }

    if (!expectedClientId || expectedClientId.trim().length === 0) {
      throw new Error('Auth0 Client ID is not configured');
    }

    try {
      // Get Auth0 domain from environment
      const domain = process.env.OAUTH_AUTH0_DOMAIN;
      if (!domain || domain.trim().length === 0) {
        throw new Error('Auth0 Domain is not configured');
      }

      // Decode token header to get key ID (kid)
      const decodedHeader = jwt.decode(idToken, { complete: true });
      if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new Error('Invalid Auth0 ID token format');
      }

      const header = decodedHeader.header;
      if (!header.kid) {
        throw new Error('Auth0 ID token missing key ID (kid)');
      }

      // Fetch JWKS and get the public key
      const jwks = await this.fetchJWKS(domain);
      const key = jwks.find((k: any) => k.kid === header.kid);

      if (!key) {
        throw new Error(`Key with kid '${header.kid}' not found in Auth0 JWKS`);
      }

      // Decode token to get payload
      const decoded = jwt.decode(idToken, { complete: true });
      
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid Auth0 ID token format');
      }

      const payload = decoded.payload as any;

      // Verify issuer
      const issuer = `https://${domain}/`;
      if (payload.iss !== issuer) {
        throw new Error(`Auth0 ID token issuer mismatch. Expected: ${issuer}, Got: ${payload.iss}`);
      }

      // Verify audience
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(expectedClientId)) {
        throw new Error(`Auth0 ID token audience mismatch. Expected: ${expectedClientId}, Got: ${payload.aud}`);
      }

      // Verify expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Auth0 ID token has expired');
      }

      // Verify not before
      if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
        throw new Error('Auth0 ID token is not yet valid');
      }

      // Extract required fields
      if (!payload.sub) {
        throw new Error('Auth0 ID token missing user ID (sub)');
      }

      // Email might be in 'email' claim
      const email = payload.email;
      if (!email) {
        throw new Error('Auth0 ID token missing email');
      }

      // Verify email is verified if claim exists
      if (payload.email_verified === false) {
        throw new Error('Auth0 email is not verified');
      }

      // Verify signature using the public key from JWKS
      try {
        // Convert JWK to PEM and verify
        const publicKeyPem = this.jwkToPem(key);
        jwt.verify(idToken, publicKeyPem, {
          algorithms: ['RS256'],
          issuer,
          audience: expectedClientId,
        });
      } catch (verifyError) {
        if (verifyError instanceof jwt.JsonWebTokenError) {
          throw new Error(`Auth0 ID token signature verification failed: ${verifyError.message}`);
        }
        if (verifyError instanceof jwt.TokenExpiredError) {
          throw new Error('Auth0 ID token has expired');
        }
        if (verifyError instanceof jwt.NotBeforeError) {
          throw new Error('Auth0 ID token is not yet valid');
        }
        throw verifyError;
      }

      return {
        userId: payload.sub,
        email: email.toLowerCase(),
      };
    } catch (error) {
      if (error instanceof Error) {
        // Don't expose internal errors, provide user-friendly messages
        if (error.message.includes('expired')) {
          throw new Error('Auth0 ID token has expired');
        }
        if (error.message.includes('signature')) {
          throw new Error('Auth0 ID token signature validation failed');
        }
        if (error.message.includes('audience') || error.message.includes('issuer')) {
          throw new Error('Auth0 ID token validation failed: invalid audience or issuer');
        }
        if (error.message.includes('not configured')) {
          throw error; // Re-throw configuration errors as-is
        }
        throw new Error(`Invalid Auth0 ID token: ${error.message}`);
      }
      throw new Error('Failed to validate Auth0 ID token');
    }
  }

  async validateAuthorizationCodeAsync(): Promise<TokenValidationResult> {
    throw new Error('Auth0 OAuth uses ID token flow, not authorization code flow');
  }
}

/**
 * Factory to get the appropriate token validation service for a provider
 */
export class TokenValidationServiceFactory {
  private readonly googleService: GoogleTokenValidationService;
  private readonly microsoftService: MicrosoftTokenValidationService;
  private readonly githubService: GitHubTokenValidationService;
  private readonly auth0Service: Auth0TokenValidationService;

  constructor() {
    this.googleService = new GoogleTokenValidationService();
    this.microsoftService = new MicrosoftTokenValidationService();
    this.githubService = new GitHubTokenValidationService();
    this.auth0Service = new Auth0TokenValidationService();
  }

  getValidator(provider: AuthProvider): ITokenValidationService {
    switch (provider) {
      case 'Google':
        return this.googleService;
      case 'Microsoft':
        return this.microsoftService;
      case 'GitHub':
        return this.githubService;
      case 'Auth0':
        return this.auth0Service;
      default:
        throw new Error(`OAuth provider '${provider}' is not supported`);
    }
  }
}

// Export singleton instance
export const tokenValidationServiceFactory = new TokenValidationServiceFactory();
