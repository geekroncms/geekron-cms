import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ApiKeysPage } from './pages/ApiKeysPage';

test.describe('API Key Management', () => {
  let loginPage: LoginPage;
  let apiKeysPage: ApiKeysPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    apiKeysPage = new ApiKeysPage(page);
    
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await apiKeysPage.goto();
  });

  test('should create API key successfully', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({
      name: 'Test API Key',
      permissions: ['read', 'write'],
    });
    await apiKeysPage.submitKeyForm();
    
    await expect(apiKeysPage.getGeneratedKey()).resolves.toBeTruthy();
  });

  test('should display API key only once', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({
      name: 'One Time Key',
    });
    await apiKeysPage.submitKeyForm();
    
    const keyDisplay = apiKeysPage.getGeneratedKey();
    await expect(keyDisplay).resolves.toBeTruthy();
    
    // 刷新页面后应该看不到完整的 key
    await page.reload();
    await expect(page.locator('[class*="api-key-masked"]')).toBeVisible();
  });

  test('should copy API key to clipboard', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({ name: 'Copy Test Key' });
    await apiKeysPage.submitKeyForm();
    
    await apiKeysPage.copyKey();
    // 验证复制按钮点击成功
    await expect(page.locator('[class*="copy-success"]')).toBeVisible();
  });

  test('should display API key list', async ({ page }) => {
    await expect(apiKeysPage.getKeyRow('Test API Key')).toBeVisible();
  });

  test('should show hidden actual key', async ({ page }) => {
    const keyRow = apiKeysPage.getKeyRow('Test API Key');
    await expect(keyRow.locator('[class*="key-masked"]')).toBeVisible();
  });

  test('should display correct permissions', async ({ page }) => {
    const permissions = await apiKeysPage.getKeyPermissions('Test API Key');
    await expect(permissions).toContain('read');
    await expect(permissions).toContain('write');
  });

  test('should display expiration time', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({
      name: 'Expiring Key',
      expiresAt: '2026-12-31',
    });
    await apiKeysPage.submitKeyForm();
    
    await expect(apiKeysPage.getKeyRow('Expiring Key')).toContainText('2026-12-31');
  });

  test('should rotate API key', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({ name: 'Rotate Test Key' });
    await apiKeysPage.submitKeyForm();
    
    await apiKeysPage.rotateKey('Rotate Test Key');
    
    // 验证生成了新 key
    await expect(apiKeysPage.getGeneratedKey()).resolves.toBeTruthy();
  });

  test('should confirm old key is invalid after rotation', async ({ page }) => {
    await apiKeysPage.rotateKey('Test API Key');
    
    // 验证旧 key 失效提示
    await expect(page.locator('[class*="rotation-warning"]')).toBeVisible();
  });

  test('should delete API key with confirmation', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({ name: 'Delete Test Key' });
    await apiKeysPage.submitKeyForm();
    
    await apiKeysPage.deleteKey('Delete Test Key');
    await expect(apiKeysPage.getKeyRow('Delete Test Key')).not.toBeVisible();
  });

  test('should create key with specific permissions', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({
      name: 'Read Only Key',
      permissions: ['read'],
    });
    await apiKeysPage.submitKeyForm();
    
    const permissions = await apiKeysPage.getKeyPermissions('Read Only Key');
    await expect(permissions).toContain('read');
    await expect(permissions).not.toContain('write');
  });

  test('should create key without expiration', async ({ page }) => {
    await apiKeysPage.clickCreateKey();
    await apiKeysPage.fillKeyForm({
      name: 'Permanent Key',
    });
    await apiKeysPage.submitKeyForm();
    
    await expect(apiKeysPage.getKeyRow('Permanent Key')).toContainText('永不过期');
  });
});
