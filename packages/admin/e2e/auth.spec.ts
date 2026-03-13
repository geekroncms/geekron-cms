import { expect, test } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Geekron CMS')
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-btn"]')).toBeVisible()
  })

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'admin@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-btn"]')
    await page.waitForURL('/')
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'wrong@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-btn"]')

    // 验证错误消息显示（如果有）
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'invalid-email')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-btn"]')

    // 浏览器应该会显示验证错误
    const emailInput = page.locator('[data-testid="email-input"]')
    await expect(emailInput).toHaveAttribute('type', 'email')
  })
})
