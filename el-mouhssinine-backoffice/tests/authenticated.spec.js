import { test, expect } from '@playwright/test'

// ============================================================
// AUTHENTICATED TESTS — reuse session from auth.setup.js
// ============================================================
// Account: centreculturelislamique@orange.fr (super_admin)
// The session (Firebase Auth in IndexedDB) is loaded via
// storageState, so NO login happens here — avoids rate limits.
//
// SAFETY: We do NOT persist creations of announcements, events,
// or janaza because Cloud Functions (onNewAnnouncement, etc.)
// would send REAL push notifications to all app users. We only
// OPEN modals and test validation, then cancel. No destructive
// writes to production data.
// ============================================================

test.describe('Authenticated — navigation & rendering', () => {
  const pages = [
    '/', '/horaires', '/annonces', '/rappels', '/popups', '/evenements',
    '/janaza', '/dons', '/adherents', '/revenus', '/recus-fiscaux',
    '/messages', '/notifications', '/ramadan', '/emails', '/audit-logs',
    '/admins', '/parametres',
  ]

  test('all 18 internal pages load with content, no JS crash', async ({ page }) => {
    test.setTimeout(120000)
    const errorsByPage = {}
    let current = '/'
    page.on('pageerror', err => {
      ;(errorsByPage[current] ||= []).push(err.message)
    })

    for (const path of pages) {
      current = path
      await page.goto(path)
      // Sidebar present = authenticated + layout rendered
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
      await page.waitForTimeout(1000)
      const bodyText = await page.locator('body').textContent()
      expect(bodyText.length, `blank page on ${path}`).toBeGreaterThan(50)
    }

    const realErrors = []
    for (const [path, errs] of Object.entries(errorsByPage)) {
      for (const e of errs) {
        if (!e.includes('Firebase') && !e.includes('network') &&
            !e.includes('fetch') && !e.includes('ERR_') &&
            !e.includes('auth/') && !e.includes('permission')) {
          realErrors.push(`${path}: ${e}`)
        }
      }
    }
    expect(realErrors, realErrors.join('\n')).toHaveLength(0)
  })
})

test.describe('Authenticated — interactions', () => {
  test('sidebar links navigate correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })

    await page.locator('a[href="/adherents"]').first().click()
    await expect(page).toHaveURL(/.*adherents/)

    await page.locator('a[href="/dons"]').first().click()
    await expect(page).toHaveURL(/.*dons/)

    await page.locator('a[href="/messages"]').first().click()
    await expect(page).toHaveURL(/.*messages/)
  })

  test('Annonces — create modal opens then cancels (no persist)', async ({ page }) => {
    await page.goto('/annonces')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /nouvelle annonce/i }).first().click()
    // Modal exposes role="dialog" + aria-modal (accessibility)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('h2', { hasText: /Nouvelle annonce/i })).toBeVisible()
    // Escape key closes the modal
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('Annonces — empty form submit blocked by validation (no persist)', async ({ page }) => {
    await page.goto('/annonces')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /nouvelle annonce/i }).first().click()
    await expect(page.locator('h2', { hasText: /Nouvelle annonce/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /enregistrer|publier|créer/i }).first().click()
    await page.waitForTimeout(800)
    // Modal still open = validation worked, nothing persisted
    await expect(page.locator('h2', { hasText: /Nouvelle annonce/i })).toBeVisible()
    const bodyText = await page.locator('body').textContent()
    expect(bodyText.toLowerCase()).toMatch(/titre|contenu|obligatoire|requis|remplir/)
    await page.getByRole('button', { name: /annuler/i }).first().click()
  })

  test('Evenements — create modal opens then cancels (no persist)', async ({ page }) => {
    await page.goto('/evenements')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    const createBtn = page.getByRole('button', { name: /nouvel? ?(événement|evenement)/i })
    if (await createBtn.count() > 0) {
      await createBtn.first().click()
      await expect(page.locator('h2').filter({ hasText: /événement|evenement/i }).first()).toBeVisible({ timeout: 5000 })
      await page.getByRole('button', { name: /annuler/i }).first().click()
    }
  })

  test('Parametres — form inputs render', async ({ page }) => {
    await page.goto('/parametres')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 })
  })

  test('Admins — page shows admin emails', async ({ page }) => {
    await page.goto('/admins')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('@')
  })

  test('logout returns to login page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
    const logoutBtn = page.getByRole('button', { name: /déconnexion|deconnexion|logout|se déconnecter/i })
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click()
      await page.waitForURL('**/login', { timeout: 10000 })
      expect(page.url()).toContain('/login')
    }
  })
})
