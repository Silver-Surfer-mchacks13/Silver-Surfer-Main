# Testing Guide

## Setup

Tests are set up using Jest. Install dependencies:

```bash
npm install
```

## Running Tests

### Unit Tests (Mocked)
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage
```bash
npm run test:coverage
```

### Integration Tests (Requires Supabase)
```bash
TEST_INTEGRATION=true npm run test:integration
```

## Test Files

- `tests/auth.register.test.ts` - Registration endpoint tests
- `tests/auth.login.test.ts` - Login endpoint tests
- `tests/auth.integration.test.ts` - Full flow integration tests

## Integration Test Setup

Integration tests require:
1. Valid Supabase connection (set in `.env.local`)
2. `TEST_INTEGRATION=true` environment variable
3. Test database with migrations applied

The integration tests will:
- Create test users
- Test registration → login → token usage flow
- Clean up test data after completion
