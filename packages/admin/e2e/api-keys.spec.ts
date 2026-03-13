import { expect, test } from '@playwright/test'

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    // 导航到 API Keys
    await page.goto('/api-keys')
  })

  test('should display API Key page', async ({ page }) => {
    await expect(page.locator('[data-testid="page-title"]')).toContainText('API Key')
    await expect(page.locator('[data-testid="create-api-key-btn"]')).toBeVisible()
  })

  test('should create API key successfully', async ({ page }) => {
    // 点击创建按钮
    await page.click('[data-testid="create-api-key-btn"]')

    // 填写表单
    await page.fill('[data-testid="key-name-input"]', 'Test Key')
    await page.check('[data-testid="permission-read-checkbox"]')

    // 提交
    await page.click('[data-testid="confirm-create-key-btn"]')

    // 验证列表更新
    await expect(page.locator('[data-testid="api-keys-list"]')).toBeVisible()
  })

  test('should display API key list', async ({ page }) => {
    await expect(page.locator('[data-testid="api-keys-list"]')).toBeVisible()
  })

  test('should show permissions', async ({ page }) => {
    await expect(page.locator('[data-testid="permission-read-checkbox"]')).toBeVisible()
    await expect(page.locator('[data-testid="permission-write-checkbox"]')).toBeVisible()
  })
})
