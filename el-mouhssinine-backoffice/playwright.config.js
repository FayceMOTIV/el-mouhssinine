import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    // Public tests — no auth
    {
      name: 'public',
      testMatch: /backoffice\.spec\.js/,
      use: { browserName: 'chromium' },
    },
    // Login once, save state
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { browserName: 'chromium' },
    },
    // Authenticated tests — reuse the saved state (1 login total)
    {
      name: 'authenticated',
      testMatch: /authenticated\.spec\.js/,
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        storageState: 'tests/.auth/state.json',
      },
    },
    // Real CRUD test — creates & deletes real data (authorized)
    {
      name: 'crud',
      testMatch: /crud-real\.spec\.js/,
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        storageState: 'tests/.auth/state.json',
      },
    },
  ],
  // Server started manually
})
