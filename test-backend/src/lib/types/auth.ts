import { z } from 'zod';
import type { AuthProvider } from '@/lib/db/supabase';

// Auth Provider Enum
export const AuthProviderEnum = z.enum(['Local', 'Google', 'Microsoft', 'GitHub']);
export type AuthProviderType = z.infer<typeof AuthProviderEnum>;

// Request DTOs
export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email must not exceed 255 characters'),
  password: z.string().min(12, 'Password must be at least 12 characters').max(100, 'Password must not exceed 100 characters'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const OAuthLoginRequestSchema = z.object({
  provider: AuthProviderEnum,
  idToken: z.string().optional(),
  authorizationCode: z.string().optional(),
  redirectUri: z.string().optional(),
}).refine(
  (data) => data.idToken || data.authorizationCode,
  {
    message: 'Either idToken or authorizationCode is required',
    path: ['idToken'],
  }
);

export type OAuthLoginRequest = z.infer<typeof OAuthLoginRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

// Response DTOs
export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface ErrorResponse {
  message: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

// Password Reset DTOs
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const ConfirmPasswordResetRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(100, 'Password must not exceed 100 characters'),
});

export type ConfirmPasswordResetRequest = z.infer<typeof ConfirmPasswordResetRequestSchema>;
