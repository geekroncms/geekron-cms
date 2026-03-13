import { expect, test } from '@playwright/test'

test.describe('Users Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    await page.goto('/users')
  })

  test('should display users page', async ({ page }) => {
    await expect(page.locator('[data-testid="page-title"]')).toContainText('用户管理')
    await expect(page.locator('[data-testid="create-user-btn"]')).toBeVisible()
  })

  test('should display users list', async ({ page }) => {
    await expect(page.locator('[data-testid="users-list"]')).toBeVisible()
  })

  test('should show role badges', async ({ page }) => {
    await expect(
      page.locator('.badge-owner, .badge-admin, .badge-editor, .badge-viewer'),
    ).toBeVisible()
  })
})
