// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_ISSUER = 'TestAPI';
process.env.JWT_AUDIENCE = 'TestClient';
process.env.JWT_ACCESS_TOKEN_EXPIRATION_MINUTES = '15';
process.env.JWT_REFRESH_TOKEN_EXPIRATION_DAYS = '30';
