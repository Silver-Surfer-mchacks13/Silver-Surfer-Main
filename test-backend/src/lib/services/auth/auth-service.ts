import bcrypt from 'bcrypt';
import { supabase, table, type User, type AuthProvider } from '@/lib/db/supabase';
import { jwtTokenService } from './jwt-service';
import { refreshTokenService } from './refresh-token-service';
import { passwordValidator } from './password-validator';
import { passwordResetService } from './password-reset-service';
import { tokenValidationServiceFactory } from './oauth-validators';
import type {
  RegisterRequest,
  LoginRequest,
  OAuthLoginRequest,
  AuthResponse,
  UserDto,
} from '@/lib/types/auth';

export class AuthService {
  /**
   * Register a new user with email and password
   */
  async registerAsync(request: RegisterRequest): Promise<AuthResponse> {
    // Validate password strength
    const validation = passwordValidator.validatePassword(request.password);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid password');
    }

    // Check if email already exists for Local provider
    const { data: existingUser } = await table('users')
      .select('id')
      .eq('email', request.email.toLowerCase())
      .eq('provider', 'Local')
      .single();

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(request.password, 12);

    // Create new user (matching C# User model column names)
    const { data: user, error } = await table('users')
      .insert({
        email: request.email.toLowerCase(),
        PasswordHash: passwordHash,
        provider: 'Local',
        ProviderUserId: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return this.generateAuthResponseAsync(user as User);
  }

  /**
   * Login with email and password
   */
  async loginAsync(request: LoginRequest): Promise<AuthResponse> {
    // Find user by email and Local provider
    const { data: user, error } = await table('users')
      .select('*')
      .eq('email', request.email.toLowerCase())
      .eq('provider', 'Local')
      .single();

    if (error || !user) {
      // Use same error message to prevent email enumeration
      throw new Error('Invalid email or password');
    }

    // Verify password (matching C# column name: PasswordHash)
    if (!user.PasswordHash) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(request.password, user.PasswordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    return this.generateAuthResponseAsync(user as User);
  }

  /**
   * Login with OAuth provider (Google, Microsoft, GitHub)
   */
  async loginWithOAuthAsync(request: OAuthLoginRequest): Promise<AuthResponse> {
    const provider = request.provider as AuthProvider;

    // Get validator for the provider
    const validator = tokenValidationServiceFactory.getValidator(provider);

    // Get client ID and secret from environment
    let clientId: string;
    let clientSecret: string | undefined;

    switch (provider) {
      case 'Google':
        clientId = process.env.OAUTH_GOOGLE_CLIENT_ID || '';
        if (!clientId) {
          throw new Error('Google Client ID is not configured');
        }
        break;
      case 'Microsoft':
        clientId = process.env.OAUTH_MICROSOFT_CLIENT_ID || '';
        if (!clientId) {
          throw new Error('Microsoft Client ID is not configured');
        }
        break;
      case 'GitHub':
        clientId = process.env.OAUTH_GITHUB_CLIENT_ID || '';
        clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
        if (!clientId) {
          throw new Error('GitHub Client ID is not configured');
        }
        if (!clientSecret) {
          throw new Error('GitHub Client Secret is not configured');
        }
        break;
      default:
        throw new Error(`OAuth provider '${provider}' is not supported`);
    }

    // Validate token/code
    let validationResult;
    try {
      if (request.authorizationCode) {
        if (!request.redirectUri) {
          throw new Error('Redirect URI is required for authorization code flow');
        }
        validationResult = await validator.validateAuthorizationCodeAsync(
          request.authorizationCode,
          request.redirectUri,
          clientId,
          clientSecret
        );
      } else if (request.idToken) {
        validationResult = await validator.validateIdTokenAsync(request.idToken, clientId);
      } else {
        throw new Error('Either IdToken or AuthorizationCode must be provided');
      }
    } catch (error) {
      // Re-throw validation errors with context
      if (error instanceof Error) {
        if (error.message.includes('not configured')) {
          throw new Error(`${provider} OAuth is not properly configured: ${error.message}`);
        }
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          throw new Error(`${provider} token validation failed: ${error.message}`);
        }
        throw error;
      }
      throw new Error(`${provider} OAuth validation failed`);
    }

    // Use generic OAuth login method
    return this.loginWithOAuthAsyncInternal(
      provider,
      validationResult.userId,
      validationResult.email
    );
  }

  /**
   * Internal method to handle OAuth login after token validation
   */
  private async loginWithOAuthAsyncInternal(
    provider: AuthProvider,
    providerUserId: string,
    email: string
  ): Promise<AuthResponse> {
    // Find existing account for this provider
    const { data: existingUser } = await table('users')
      .select('*')
      .eq('provider', provider)
      .eq('ProviderUserId', providerUserId)
      .single();

    if (existingUser) {
      return this.generateAuthResponseAsync(existingUser as User);
    }

    // Check if email already exists for a different provider (account conflict)
    const { data: emailUser } = await table('users')
      .select('id, provider')
      .eq('email', email.toLowerCase())
      .single();

    if (emailUser && emailUser.provider !== provider) {
      throw new Error(`An account with this email already exists with ${emailUser.provider} provider. Please use ${emailUser.provider} to sign in.`);
    }

    if (emailUser && emailUser.provider === provider) {
      // This shouldn't happen if we checked ProviderUserId first, but handle it gracefully
      const { data: existingUser } = await table('users')
        .select('*')
        .eq('id', emailUser.id)
        .single();
      
      if (existingUser) {
        return this.generateAuthResponseAsync(existingUser as User);
      }
    }

    // Create new account for this provider
    const { data: newUser, error } = await table('users')
      .insert({
        email: email.toLowerCase(),
        PasswordHash: null,
        provider,
        ProviderUserId: providerUserId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return this.generateAuthResponseAsync(newUser as User);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokenAsync(refreshToken: string): Promise<AuthResponse> {
    // Validate refresh token
    const isValid = await refreshTokenService.isTokenValidAsync(refreshToken);
    if (!isValid) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenEntity = await refreshTokenService.getRefreshTokenAsync(refreshToken);
    if (!tokenEntity) {
      throw new Error('Invalid refresh token');
    }

    // Get user
    const { data: user, error } = await table('users')
      .select('*')
      .eq('id', tokenEntity.UserId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    // Revoke the old refresh token (token rotation)
    await refreshTokenService.revokeRefreshTokenAsync(refreshToken, 'Token rotated');

    // Generate new tokens
    return this.generateAuthResponseAsync(user as User);
  }

  /**
   * Get user by ID
   */
  async getUserByIdAsync(userId: string): Promise<UserDto | null> {
    const { data: user, error } = await table('users')
      .select('id, email, CreatedAt')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.CreatedAt,
    };
  }

  /**
   * Generate authentication response with access and refresh tokens
   */
  private async generateAuthResponseAsync(user: User): Promise<AuthResponse> {
    const { token: accessToken } = jwtTokenService.generateAccessToken(user);
    const refreshToken = await refreshTokenService.generateRefreshTokenAsync(user.id);

    const accessTokenExpirationMinutes = parseInt(
      process.env.JWT_ACCESS_TOKEN_EXPIRATION_MINUTES || '15',
      10
    );
    const refreshTokenExpirationDays = parseInt(
      process.env.JWT_REFRESH_TOKEN_EXPIRATION_DAYS || '30',
      10
    );

    const now = new Date();
    const accessTokenExpiresAt = new Date(now);
    accessTokenExpiresAt.setMinutes(accessTokenExpiresAt.getMinutes() + accessTokenExpirationMinutes);

    const refreshTokenExpiresAt = new Date(now);
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + refreshTokenExpirationDays);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.CreatedAt,
      },
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
