import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { TenantsPage } from './pages/TenantsPage';

test.describe('Tenant Management', () => {
  let loginPage: LoginPage;
  let tenantsPage: TenantsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    tenantsPage = new TenantsPage(page);
    
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await tenantsPage.goto();
  });

  test('should create tenant successfully', async ({ page }) => {
    await tenantsPage.clickCreateTenant();
    await tenantsPage.fillTenantForm({
      name: 'Test Tenant',
      subdomain: 'test-tenant',
      description: 'Test description',
    });
    await tenantsPage.submitTenantForm();
    
    await expect(tenantsPage.getTenantRow('Test Tenant')).toBeVisible();
  });

  test('should show error for duplicate subdomain', async ({ page }) => {
    await tenantsPage.clickCreateTenant();
    await tenantsPage.fillTenantForm({
      name: 'Duplicate Tenant',
      subdomain: 'existing-tenant',
    });
    await tenantsPage.submitTenantForm();
    
    await expect(page.locator('[class*="error"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await tenantsPage.clickCreateTenant();
    await tenantsPage.submitTenantForm();
    
    await expect(page.locator('[name="name"] + [class*="error"]')).toBeVisible();
    await expect(page.locator('[name="subdomain"] + [class*="error"]')).toBeVisible();
  });

  test('should display all tenants in list', async ({ page }) => {
    await expect(tenantsPage.getTenantRow('Test Tenant')).toBeVisible();
  });

  test('should have working pagination', async ({ page }) => {
    const pagination = tenantsPage.getPagination();
    await expect(pagination).toBeVisible();
  });

  test('should search tenants', async ({ page }) => {
    await tenantsPage.searchTenant('Test');
    await expect(tenantsPage.getTenantRow('Test Tenant')).toBeVisible();
  });

  test('should edit tenant successfully', async ({ page }) => {
    await tenantsPage.editTenant('Test Tenant');
    await tenantsPage.fillTenantForm({
      name: 'Updated Tenant',
      subdomain: 'test-tenant',
      description: 'Updated description',
    });
    await tenantsPage.submitTenantForm();
    
    await expect(tenantsPage.getTenantRow('Updated Tenant')).toBeVisible();
  });

  test('should activate tenant', async ({ page }) => {
    const row = tenantsPage.getTenantRow('Test Tenant');
    await row.locator('[class*="activate"], button:has-text("激活")').click();
    await expect(row).toContainText('已激活');
  });

  test('should suspend tenant', async ({ page }) => {
    const row = tenantsPage.getTenantRow('Test Tenant');
    await row.locator('[class*="suspend"], button:has-text("暂停")').click();
    await expect(row).toContainText('已暂停');
  });

  test('should soft delete tenant', async ({ page }) => {
    await tenantsPage.deleteTenant('Test Tenant');
    await expect(tenantsPage.getTenantRow('Test Tenant')).not.toBeVisible();
  });

  test('should check subdomain availability in real-time', async ({ page }) => {
    await tenantsPage.clickCreateTenant();
    await tenantsPage.fillTenantForm({
      name: 'New Tenant',
      subdomain: 'unique-subdomain',
    });
    
    const status = await tenantsPage.getSubdomainStatus();
    await expect(status).toContain('可用');
  });
});
