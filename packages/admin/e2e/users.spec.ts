import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';

test.describe('User Management', () => {
  let loginPage: LoginPage;
  let usersPage: UsersPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    usersPage = new UsersPage(page);
    
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await usersPage.goto();
  });

  test('should display user list', async ({ page }) => {
    await expect(usersPage.getUserRow('admin@example.com')).toBeVisible();
  });

  test('should have pagination working', async ({ page }) => {
    await expect(page.locator('[class*="pagination"]')).toBeVisible();
  });

  test('should filter users', async ({ page }) => {
    await page.fill('[class*="filter"], select[name="role"]', 'admin');
    await expect(page.locator('[class*="user-row"]')).toBeVisible();
  });

  test('should create user successfully', async ({ page }) => {
    await usersPage.clickCreateUser();
    await usersPage.fillUserForm({
      email: 'newuser@example.com',
      name: 'New User',
      password: 'password123',
      role: 'user',
    });
    await usersPage.submitUserForm();
    
    await expect(usersPage.getUserRow('newuser@example.com')).toBeVisible();
  });

  test('should show error for duplicate email', async ({ page }) => {
    await usersPage.clickCreateUser();
    await usersPage.fillUserForm({
      email: 'admin@example.com',
      name: 'Duplicate User',
      password: 'password123',
    });
    await usersPage.submitUserForm();
    
    await expect(page.locator('[class*="error"]')).toBeVisible();
  });

  test('should assign role when creating user', async ({ page }) => {
    await usersPage.clickCreateUser();
    await usersPage.fillUserForm({
      email: 'roleuser@example.com',
      name: 'Role User',
      role: 'editor',
    });
    await usersPage.submitUserForm();
    
    const row = usersPage.getUserRow('roleuser@example.com');
    await expect(row).toContainText('editor');
  });

  test('should edit user successfully', async ({ page }) => {
    await usersPage.editUser('admin@example.com');
    await usersPage.fillUserForm({
      email: 'admin@example.com',
      name: 'Updated Admin',
    });
    await usersPage.submitUserForm();
    
    await expect(usersPage.getUserRow('Updated Admin')).toBeVisible();
  });

  test('should change user role', async ({ page }) => {
    await usersPage.assignRole('admin@example.com', 'editor');
    await expect(usersPage.getUserRow('admin@example.com')).toContainText('editor');
  });

  test('should disable/enable user', async ({ page }) => {
    await usersPage.toggleUserStatus('admin@example.com');
    await expect(usersPage.getUserRow('admin@example.com')).toContainText('已禁用');
    
    await usersPage.toggleUserStatus('admin@example.com');
    await expect(usersPage.getUserRow('admin@example.com')).toContainText('已启用');
  });

  test('should delete user with confirmation', async ({ page }) => {
    await usersPage.clickCreateUser();
    await usersPage.fillUserForm({
      email: 'deleteuser@example.com',
      name: 'Delete User',
      password: 'password123',
    });
    await usersPage.submitUserForm();
    
    await usersPage.deleteUser('deleteuser@example.com');
    await expect(usersPage.getUserRow('deleteuser@example.com')).not.toBeVisible();
  });
});
