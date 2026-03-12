import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await loginPage.isLoggedIn();
  });

  test('should show error for invalid password', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'wrongpassword');
    await expect(loginPage.getErrorMessage()).resolves.toBeTruthy();
  });

  test('should show error for non-existent email', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('nonexistent@example.com', 'password123');
    await expect(loginPage.getErrorMessage()).resolves.toBeTruthy();
  });

  test('should show validation error for empty form', async ({ page }) => {
    await loginPage.goto();
    await loginPage.getSubmitButton().then(btn => btn.click());
    await expect(loginPage.hasValidationError('email')).resolves.toBeTruthy();
  });

  test('should remember login state after refresh', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await loginPage.isLoggedIn();
    
    // 刷新页面
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard|\/$/);
  });

  test('should logout and redirect to login page', async ({ page }) => {
    // 先登录
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await loginPage.isLoggedIn();
    
    // 登出
    await dashboardPage.goto();
    await dashboardPage.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing protected page after logout', async ({ page }) => {
    // 先登录再登出
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await dashboardPage.logout();
    
    // 尝试访问受保护页面
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
