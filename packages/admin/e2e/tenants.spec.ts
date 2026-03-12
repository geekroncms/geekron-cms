import { test, expect } from '@playwright/test';

test.describe('Tenants Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // 导航到租户管理
    await page.goto('/tenants');
  });

  test('should display tenants page', async ({ page }) => {
    await expect(page.locator('[data-testid="page-title"]')).toContainText('租户管理');
    await expect(page.locator('[data-testid="create-tenant-btn"]')).toBeVisible();
  });

  test('should create tenant successfully', async ({ page }) => {
    // 点击创建按钮
    await page.click('[data-testid="create-tenant-btn"]');
    
    // 填写表单
    await page.fill('[data-testid="tenant-name-input"]', 'Test Tenant');
    await page.fill('[data-testid="tenant-subdomain-input"]', 'test-tenant');
    await page.fill('[data-testid="tenant-email-input"]', 'test@example.com');
    await page.selectOption('[data-testid="tenant-plan-select"]', 'pro');
    
    // 提交
    await page.click('[data-testid="confirm-create-btn"]');
    
    // 验证列表更新
    await expect(page.locator('[data-testid="tenants-list"]')).toBeVisible();
  });

  test('should display tenant list', async ({ page }) => {
    await expect(page.locator('[data-testid="tenants-list"]')).toBeVisible();
  });

  test('should show plan badges', async ({ page }) => {
    await expect(page.locator('.badge-free, .badge-pro, .badge-enterprise')).toBeVisible();
  });
});
