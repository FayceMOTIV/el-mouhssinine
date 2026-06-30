import { test, expect } from '@playwright/test'

// ============================================================
// REAL CRUD TEST — creates, notifies, and deletes a real
// announcement in production Firestore.
// Authorized by Faiçal: only admins use the app for now, so a
// test push notification is acceptable.
// The test cleans up after itself (deletes what it creates).
// ============================================================

const STAMP = `TEST-PLAYWRIGHT ${new Date().toISOString().slice(0, 16)}`

test('Annonces — full lifecycle: create → appears → delete', async ({ page }) => {
  test.setTimeout(90000)

  await page.goto('/annonces')
  await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(1500)

  // --- CREATE ---
  await page.getByRole('button', { name: /nouvelle annonce/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

  // Fill title + content by placeholder (Input has no explicit type attr)
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder(/Ex:|Fermeture/i).fill(`${STAMP} — Annonce de test`)
  await dialog.getByPlaceholder(/Détails de l'annonce/i).fill('Annonce de test automatisée. Supprimée immédiatement.')

  // Save
  await dialog.getByRole('button', { name: /enregistrer|publier|créer/i }).first().click()

  // Modal should close (success) — wait for it to disappear
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })

  // --- VERIFY IT APPEARS ---
  await page.waitForTimeout(2000)
  await expect(page.locator('body')).toContainText(STAMP, { timeout: 10000 })

  // --- DELETE (cleanup) ---
  // Find the row containing our stamp, click its delete button
  const row = page.locator('tr', { hasText: STAMP }).first()
  await expect(row).toBeVisible()
  // Click the delete (trash) button in that row — last icon button
  const deleteBtn = row.getByRole('button').last()
  await deleteBtn.click()

  // Confirm deletion in the ConfirmModal (scope to the dialog)
  const confirmDialog = page.getByRole('dialog')
  await expect(confirmDialog).toBeVisible({ timeout: 5000 })
  await confirmDialog.getByRole('button', { name: /supprimer|confirmer/i }).first().click()

  // Wait for deletion to complete
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })
  await page.waitForTimeout(2000)

  // --- VERIFY IT'S GONE ---
  await expect(page.locator('body')).not.toContainText(STAMP, { timeout: 10000 })
})
