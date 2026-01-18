import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

// Mock auth service
jest.mock('@/lib/services/auth/auth-service', () => ({
  authService: {
    loginAsync: jest.fn(),
  },
}));

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to not interfere with validation tests
    const { authService } = require('@/lib/services/auth/auth-service');
    authService.loginAsync.mockReset();
  });

  it('should login successfully with valid credentials', async () => {
    const { authService } = require('@/lib/services/auth/auth-service');
    
    const mockAuthResponse = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      accessTokenExpiresAt: new Date().toISOString(),
      refreshTokenExpiresAt: new Date().toISOString(),
    };

    authService.loginAsync.mockResolvedValue(mockAuthResponse);

    const requestBody = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
    expect(data.user.email).toBe('test@example.com');
    expect(authService.loginAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
    );
  });

  it('should return 401 for invalid credentials', async () => {
    const { authService } = require('@/lib/services/auth/auth-service');
    
    authService.loginAsync.mockRejectedValue(new Error('Invalid email or password'));

    const requestBody = {
      email: 'test@example.com',
      password: 'WrongPassword123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('message');
    expect(data.message).toContain('Invalid email or password');
  });

  it('should return 400 for invalid request data', async () => {
    const requestBody = {
      email: 'invalid-email',
      password: '123',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('errors');
  });

  it('should handle missing email', async () => {
    const requestBody = {
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle missing password', async () => {
    const requestBody = {
      email: 'test@example.com',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 401 for non-existent user', async () => {
    const { authService } = require('@/lib/services/auth/auth-service');
    
    authService.loginAsync.mockRejectedValue(new Error('Invalid email or password'));

    const requestBody = {
      email: 'nonexistent@example.com',
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toContain('Invalid email or password');
  });
});
