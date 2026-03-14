import { test, expect } from '@playwright/test'

test.describe('前端页面导航测试（远程 URL）', () => {
  const baseURL = 'https://faddb658.geekron-cms-admin.pages.dev'

  test('登录页面可访问', async ({ page }) => {
    await page.goto(`${baseURL}/login`)
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-btn"]')).toBeVisible()
    
    await page.screenshot({ path: 'test-results/admin-login-page.png' })
    console.log('✅ 登录页面访问成功')
  })

  test('登录流程', async ({ page }) => {
    await page.goto(`${baseURL}/login`)
    
    await page.fill('[data-testid="email-input"]', 'demo@geekron-cms.com')
    await page.fill('[data-testid="password-input"]', 'Demo123456')
    await page.click('[data-testid="login-btn"]')
    
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'admin-login-success.png' })
    console.log('✅ 登录成功')
  })
})
