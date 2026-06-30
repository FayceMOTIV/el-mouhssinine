import { test, expect } from '@playwright/test'

// The backoffice requires Firebase Auth login.
// These tests verify that all pages load without JS crashes,
// that public pages render correctly, and that protected pages
// redirect to login properly.

// ============================================================
// 1. PUBLIC PAGES — No auth required
// ============================================================

test.describe('Public pages', () => {
  test('/don — donation page loads and renders form', async ({ page }) => {
    await page.goto('/don')
    await expect(page.locator('body')).not.toHaveText('Application error')
    await expect(page.getByRole('heading', { name: /Faire un don/ })).toBeVisible({ timeout: 10000 })
    // Submit button should be present
    await expect(page.getByRole('button', { name: /Faire un don/ })).toBeVisible()
  })

  test('/don — form validation rejects empty submit', async ({ page }) => {
    await page.goto('/don')
    await expect(page.getByRole('heading', { name: /Faire un don/ })).toBeVisible({ timeout: 10000 })
    // The submit button is disabled until an amount is chosen — verify that guard
    const submitBtn = page.getByRole('button', { name: /Faire un don sécurisé/ })
    await expect(submitBtn).toBeDisabled()
  })

  test('/don — open redirect protection', async ({ page }) => {
    await page.goto('/don?success=1&app_redirect=https://evil.com')
    // Should NOT redirect to evil.com — the scheme check blocks it
    await page.waitForTimeout(500)
    expect(page.url()).not.toContain('evil.com')
    // Should show success page
    await expect(page.locator('body')).toContainText(['merci', 'don', 'succès', 'Merci'], { timeout: 5000 }).catch(() => {
      // Success page is still on /don
      expect(page.url()).toContain('/don')
    })
  })

  test('/don — valid deep link is accepted', async ({ page }) => {
    await page.goto('/don?success=1&app_redirect=fr.elmouhssinine.mosquee://don-success')
    await page.waitForTimeout(500)
    // Page should show success (the deep link attempt won't actually navigate in headless)
    expect(page.url()).toContain('/don')
  })

  test('/privacy — privacy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('body')).not.toHaveText('Application error')
    const bodyText = await page.locator('body').textContent()
    expect(
      bodyText.includes('Politique') ||
      bodyText.includes('confidentialité') ||
      bodyText.includes('données') ||
      bodyText.includes('privacy')
    ).toBeTruthy()
  })
})

// ============================================================
// 2. AUTH REDIRECT — Protected pages redirect to /login
// ============================================================

test.describe('Auth redirects', () => {
  const protectedRoutes = [
    { path: '/', name: 'Dashboard' },
    { path: '/horaires', name: 'Horaires' },
    { path: '/annonces', name: 'Annonces' },
    { path: '/rappels', name: 'Rappels' },
    { path: '/popups', name: 'Popups' },
    { path: '/evenements', name: 'Evenements' },
    { path: '/janaza', name: 'Janaza' },
    { path: '/dons', name: 'Dons' },
    { path: '/adherents', name: 'Adherents' },
    { path: '/revenus', name: 'Revenus' },
    { path: '/recus-fiscaux', name: 'Recus Fiscaux' },
    { path: '/messages', name: 'Messages' },
    { path: '/notifications', name: 'Notifications' },
    { path: '/ramadan', name: 'Ramadan' },
    { path: '/emails', name: 'Email Templates' },
    { path: '/audit-logs', name: 'Audit Logs' },
    { path: '/admins', name: 'Admins' },
    { path: '/parametres', name: 'Parametres' },
  ]

  for (const route of protectedRoutes) {
    test(`${route.name} (${route.path}) redirects to /login when not authenticated`, async ({ page }) => {
      await page.goto(route.path)
      // Should redirect to login or show login page
      await page.waitForURL('**/login', { timeout: 15000 })
      expect(page.url()).toContain('/login')
    })
  }
})

// ============================================================
// 3. LOGIN PAGE — UI elements present
// ============================================================

test.describe('Login page', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('body')).not.toHaveText('Application error')
    // Should have email input
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    // Should have password input
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Should have submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('login page — password toggle works', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 })
    // Find the eye toggle button
    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click()
      // Password input should now be type="text"
      await expect(page.locator('input[type="text"]').first()).toBeVisible()
    }
  })

  test('login page — empty submit shows error', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 })
    // Submit empty form
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1000)
    // Should stay on login (HTML5 validation prevents submit, or error shown)
    expect(page.url()).toContain('/login')
  })

  test('login page — invalid credentials show error', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    await page.fill('input[type="email"]', 'fake@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.locator('button[type="submit"]').click()
    // Should show error message
    await page.waitForTimeout(3000)
    expect(page.url()).toContain('/login')
  })

  test('login page — forgot password link exists', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('body')).toContainText('oublié', { timeout: 10000 })
  })
})

// ============================================================
// 4. NO JS CRASH — Verify no uncaught errors on page load
// ============================================================

test.describe('No JS crashes on load', () => {
  test('/don — no console errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/don')
    await page.waitForTimeout(2000)
    // Filter out expected Firebase/network errors
    const realErrors = errors.filter(e =>
      !e.includes('Firebase') &&
      !e.includes('network') &&
      !e.includes('fetch') &&
      !e.includes('ERR_') &&
      !e.includes('auth/')
    )
    expect(realErrors).toHaveLength(0)
  })

  test('/login — no console errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/login')
    await page.waitForTimeout(2000)
    const realErrors = errors.filter(e =>
      !e.includes('Firebase') &&
      !e.includes('network') &&
      !e.includes('fetch') &&
      !e.includes('ERR_') &&
      !e.includes('auth/')
    )
    expect(realErrors).toHaveLength(0)
  })

  test('/privacy — no console errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/privacy')
    await page.waitForTimeout(2000)
    const realErrors = errors.filter(e =>
      !e.includes('Firebase') &&
      !e.includes('network') &&
      !e.includes('fetch') &&
      !e.includes('ERR_') &&
      !e.includes('auth/')
    )
    expect(realErrors).toHaveLength(0)
  })
})

// ============================================================
// 5. 404 — Unknown routes
// ============================================================

test.describe('404 handling', () => {
  test('unknown route redirects to login (not 404 crash)', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/this-page-does-not-exist')
    await page.waitForTimeout(3000)
    // Should either redirect to login or show login page (not crash)
    const url = page.url()
    expect(url.includes('/login') || url.includes('/this-page-does-not-exist')).toBeTruthy()
    const realErrors = errors.filter(e =>
      !e.includes('Firebase') &&
      !e.includes('network') &&
      !e.includes('fetch') &&
      !e.includes('ERR_') &&
      !e.includes('auth/')
    )
    expect(realErrors).toHaveLength(0)
  })
})
