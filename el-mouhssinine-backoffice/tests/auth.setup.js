import { test as setup, expect } from '@playwright/test'

const EMAIL = 'centreculturelislamique@orange.fr'
const PASSWORD = 'Mosquee2026!'
const authFile = 'tests/.auth/state.json'

// Logs in ONCE and saves the authenticated state (including IndexedDB
// where Firebase Auth stores its session). All authenticated tests
// reuse this state — so we only hit Firebase signIn a single time,
// avoiding auth/too-many-requests rate limiting.

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  // Wait for redirect away from /login (successful auth)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  // Confirm the layout is rendered (sidebar present)
  await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })

  // Save state INCLUDING IndexedDB (Firebase Auth persistence)
  await page.context().storageState({ path: authFile, indexedDB: true })
})
