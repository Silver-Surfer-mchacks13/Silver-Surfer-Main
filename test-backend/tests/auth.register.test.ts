import { POST } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';

// Mock auth service
jest.mock('@/lib/services/auth/auth-service', () => ({
  authService: {
    registerAsync: jest.fn(),
  },
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a new user successfully', async () => {
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

    authService.registerAsync.mockResolvedValue(mockAuthResponse);

    const requestBody = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
    expect(data.user.email).toBe('test@example.com');
    expect(authService.registerAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
    );
  });

  it('should return 400 for invalid request data', async () => {
    const requestBody = {
      email: 'invalid-email',
      password: '123', // Too short
    };

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
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

  it('should return 409 for duplicate email', async () => {
    const { authService } = require('@/lib/services/auth/auth-service');
    
    authService.registerAsync.mockRejectedValue(new Error('Email already exists'));

    const requestBody = {
      email: 'existing@example.com',
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toHaveProperty('message');
    expect(data.message).toContain('Email already exists');
  });

  it('should handle missing email', async () => {
    const requestBody = {
      password: 'SecurePass123!',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
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

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
