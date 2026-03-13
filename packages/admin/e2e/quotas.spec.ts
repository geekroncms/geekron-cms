import { expect, test } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { QuotasPage } from './pages/QuotasPage'

test.describe('Quota Management', () => {
  let loginPage: LoginPage
  let quotasPage: QuotasPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    quotasPage = new QuotasPage(page)

    await loginPage.goto()
    await loginPage.login('admin@example.com', 'password123')
    await quotasPage.goto()
  })

  test('should display current plan', async ({ page }) => {
    const plan = await quotasPage.getCurrentPlan()
    await expect(plan).toBeTruthy()
  })

  test('should display quota usage', async ({ page }) => {
    await expect(quotasPage.getQuotaUsage('storage')).toBeVisible()
    await expect(quotasPage.getQuotaUsage('apiCalls')).toBeVisible()
    await expect(quotasPage.getQuotaUsage('users')).toBeVisible()
  })

  test('should display usage progress bar', async ({ page }) => {
    const progressBar = quotasPage.getUsageProgress('storage')
    await expect(progressBar).toBeVisible()
  })

  test('should show warning when usage > 80%', async ({ page }) => {
    // Mock 高使用量
    await page.route('**/api/quotas', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          storage: { used: 85, limit: 100 },
          apiCalls: { used: 50, limit: 100 },
        }),
      })
    })

    await quotasPage.goto()
    await expect(quotasPage.getWarningMessage()).toBeVisible()
  })

  test('should show error when usage > 100%', async ({ page }) => {
    // Mock 超额使用量
    await page.route('**/api/quotas', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          storage: { used: 120, limit: 100 },
          apiCalls: { used: 50, limit: 100 },
        }),
      })
    })

    await quotasPage.goto()
    await expect(quotasPage.getErrorMessage()).toBeVisible()
  })

  test('should display available plans', async ({ page }) => {
    const plans = quotasPage.getAvailablePlans()
    await expect(plans.first()).toBeVisible()
  })

  test('should upgrade plan successfully', async ({ page }) => {
    await quotasPage.upgradePlan('Pro')

    await expect(page.locator('[class*="upgrade-success"]')).toBeVisible()
  })

  test('should update quota immediately after upgrade', async ({ page }) => {
    await quotasPage.upgradePlan('Pro')

    // 验证配额已更新
    await quotasPage.checkQuotaUpdated('storage', 'Pro')
  })

  test('should show plan comparison', async ({ page }) => {
    await expect(page.locator('[class*="plan-comparison"]')).toBeVisible()
  })

  test('should display quota limits for current plan', async ({ page }) => {
    await expect(page.locator('[class*="quota-limit"]')).toBeVisible()
  })

  test('should show usage history', async ({ page }) => {
    await expect(page.locator('[class*="usage-history"], [class*="usage-chart"]')).toBeVisible()
  })

  test('should allow plan downgrade', async ({ page }) => {
    await quotasPage.upgradePlan('Basic')
    await expect(page.locator('[class*="downgrade-warning"]')).toBeVisible()
  })
})
