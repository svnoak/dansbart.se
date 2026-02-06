// E2E tests run against a live stack: docker compose up (db, redis, api, frontend, worker-feature)
// Then: cd dansbart.se/e2e && npm install && npm run e2e

const baseURL = process.env.FRONTEND_URL || 'http://localhost:8080';
const apiBaseURL = process.env.API_URL || 'http://localhost:8000';

export default {
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'api', testMatch: /api.*\.spec\.js/ },
    { name: 'frontend', testMatch: /frontend.*\.spec\.js/, dependencies: ['api'] },
  ],
};

export { apiBaseURL };
