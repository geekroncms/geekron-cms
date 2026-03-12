import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ContentPage } from './pages/ContentPage';

test.describe('Content Management', () => {
  let loginPage: LoginPage;
  let contentPage: ContentPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    contentPage = new ContentPage(page);
    
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'password123');
    await contentPage.goto('test-collection');
  });

  test('should create content successfully', async ({ page }) => {
    await contentPage.clickCreateContent();
    await contentPage.fillContentForm({
      title: 'Test Content',
      slug: 'test-content',
      description: 'Test description',
    });
    await contentPage.submitContentForm();
    
    await expect(contentPage.getContentRow('test-content')).toBeVisible();
  });

  test('should show validation errors', async ({ page }) => {
    await contentPage.clickCreateContent();
    await contentPage.submitContentForm();
    
    await expect(page.locator('[name="title"] + [class*="error"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await contentPage.clickCreateContent();
    await contentPage.fillContentForm({
      slug: 'incomplete-content',
    });
    await contentPage.submitContentForm();
    
    await expect(page.locator('[name="title"] + [class*="error"]')).toBeVisible();
  });

  test('should display content list', async ({ page }) => {
    await expect(contentPage.getContentRow('test-content')).toBeVisible();
  });

  test('should have pagination working', async ({ page }) => {
    await expect(page.locator('[class*="pagination"]')).toBeVisible();
  });

  test('should search content', async ({ page }) => {
    await contentPage.searchContent('Test');
    await expect(contentPage.getContentRow('test-content')).toBeVisible();
  });

  test('should filter content', async ({ page }) => {
    await page.selectOption('[class*="filter"], select[name="status"]', 'published');
    await expect(page.locator('[class*="content-row"]')).toBeVisible();
  });

  test('should sort content', async ({ page }) => {
    await contentPage.sortBy('Created At');
    await expect(page.locator('[class*="content-row"]')).toBeVisible();
  });

  test('should edit content successfully', async ({ page }) => {
    await contentPage.editContent('test-content');
    await contentPage.fillContentForm({
      title: 'Updated Content',
      slug: 'test-content',
      description: 'Updated description',
    });
    await contentPage.submitContentForm();
    
    await expect(contentPage.getContentRow('Updated Content')).toBeVisible();
  });

  test('should load existing data when editing', async ({ page }) => {
    await contentPage.editContent('test-content');
    await expect(page.locator('[name="title"]')).toHaveValue('Test Content');
  });

  test('should delete single content with confirmation', async ({ page }) => {
    await contentPage.deleteContent('test-content');
    await expect(contentPage.getContentRow('test-content')).not.toBeVisible();
  });

  test('should select content for bulk action', async ({ page }) => {
    await contentPage.selectContent('test-content');
    await expect(page.locator('[class*="bulk-actions"]')).toBeVisible();
  });

  test('should bulk delete content', async ({ page }) => {
    await contentPage.selectContent('test-content');
    await contentPage.bulkDelete();
    await expect(contentPage.getContentRow('test-content')).not.toBeVisible();
  });

  test('should bulk edit content', async ({ page }) => {
    await contentPage.selectContent('test-content');
    await page.click('button:has-text("批量编辑"), [class*="bulk-edit"]');
    await page.selectOption('[name="status"]', 'published');
    await page.click('button:has-text("保存")');
    
    await expect(contentPage.getContentRow('test-content')).toContainText('published');
  });
});
