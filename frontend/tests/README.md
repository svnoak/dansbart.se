# Frontend Test Suite

This test suite ensures that authentication and API integration work correctly between the frontend and backend. It's specifically designed to catch issues like the 403 error where login succeeds but subsequent requests fail.

## Setup

Install dependencies:

```bash
cd dansbart.se/frontend
npm install
```

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.js                    # Test setup (MSW, mocks, localStorage)
├── mocks/
│   └── handlers.js             # MSW request handlers for backend API
├── auth/
│   ├── admin-auth.test.js      # Admin authentication tests
│   └── main-auth.test.js       # Main app OIDC authentication tests
├── api/
│   ├── custom-fetch.test.js    # customAdminFetch tests
│   └── useAdminApi.test.js     # useAdminApi composable tests
└── integration/
    └── admin-login-flow.test.js # End-to-end login flow tests
```

## What These Tests Cover

### Authentication Flow
- ✅ Password-based admin login
- ✅ Token storage and retrieval
- ✅ Token verification
- ✅ OIDC authentication (mocked)
- ✅ Token refresh on 401 errors
- ✅ Logout and token invalidation

### API Integration
- ✅ Authenticated API requests
- ✅ Authorization header handling
- ✅ 401 Unauthorized handling
- ✅ 403 Forbidden handling
- ✅ Token persistence across requests
- ✅ Error handling and retries

### Bug Detection
- ✅ **Token storage key mismatch**: Tests catch when `useAdminAuth` stores tokens as `admin_password_token` but `customAdminFetch` reads from `admin_token`
- ✅ **Missing Authorization headers**: Tests verify tokens are included in requests
- ✅ **Token expiration**: Tests handle expired tokens gracefully
- ✅ **403 after successful login**: Integration tests reproduce the exact scenario

## Known Issues Detected

### Token Storage Key Mismatch

**Problem**: `useAdminAuth` stores the password token as `admin_password_token`, but `customAdminFetch` reads from `admin_token`. This causes API calls to fail with 403 even after successful login.

**Files involved**:
- `admin/shared/composables/useAdminAuth.js` - stores token as `admin_password_token`
- `admin/api/custom-fetch.ts` - reads token as `admin_token`

**Test**: `tests/integration/admin-login-flow.test.js` - "should fail when customAdminFetch uses wrong localStorage key"

**Fix**: Either:
1. Update `customAdminFetch` to read from `admin_password_token`, OR
2. Update `useAdminAuth` to also set `admin_token` when storing password tokens, OR
3. Use `useAdminApi` composable instead of `customAdminFetch` (it uses the token from `useAdminAuth` correctly)

## Writing New Tests

When adding new API endpoints or authentication flows:

1. Add handlers to `tests/mocks/handlers.js`
2. Write tests in the appropriate directory (`auth/`, `api/`, or `integration/`)
3. Use MSW handlers to mock backend responses
4. Test both success and error scenarios
5. Verify tokens are properly included in requests

## Example Test

```javascript
import { describe, it, expect } from 'vitest';
import { server } from '../setup.js';
import { http, HttpResponse } from 'msw';

describe('My Feature', () => {
  it('should make authenticated API call', async () => {
    localStorage.setItem('admin_token', 'test-token');
    
    const response = await fetch('/api/admin/my-endpoint', {
      headers: { 'Authorization': 'Bearer test-token' },
    });
    
    expect(response.ok).toBe(true);
  });
});
```

## Debugging Failed Tests

1. Check the test output for specific error messages
2. Verify MSW handlers are set up correctly in `tests/mocks/handlers.js`
3. Check localStorage state - tests clear it between runs
4. Use `console.log` in tests to debug (they're removed in production)
5. Run tests with `npm run test:ui` for better debugging experience
