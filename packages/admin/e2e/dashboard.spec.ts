import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

test.describe('Dashboard', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)

    // 登录
    await loginPage.goto()
    await loginPage.login('admin@example.com', 'password123')
    await dashboardPage.goto()
  })

  test('should load dashboard with tenant stats', async ({ page }) => {
    await expect(dashboardPage.getTenantStats()).toBeVisible()
  })

  test('should display quick action buttons', async ({ page }) => {
    await expect(dashboardPage.getQuickActions()).toBeVisible()
  })

  test('should show recent activity section', async ({ page }) => {
    await expect(dashboardPage.getRecentActivity()).toBeVisible()
  })

  test('should display correct statistics', async ({ page }) => {
    const statCards = await dashboardPage.getStatCard('租户')
    await expect(statCards).toBeVisible()
  })

  test('should have clickable quick action buttons', async ({ page }) => {
    const quickActions = dashboardPage.getQuickActions()
    await expect(quickActions.first()).toBeEnabled()
  })

  test('should navigate correctly from quick actions', async ({ page }) => {
    await dashboardPage.clickQuickAction('创建租户')
    await expect(page).toHaveURL(/\/tenants/)
  })

  test('should have responsive layout', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(dashboardPage.getTenantStats()).toBeVisible()

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(dashboardPage.getTenantStats()).toBeVisible()

    // Mobile
    await page.setViewportSize({ width: 393, height: 852 })
    await expect(dashboardPage.getTenantStats()).toBeVisible()
  })
})
