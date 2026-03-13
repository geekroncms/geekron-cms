import { expect, test } from '@playwright/test'
import { CollectionsPage } from './pages/CollectionsPage'
import { LoginPage } from './pages/LoginPage'

test.describe('Collection Management', () => {
  let loginPage: LoginPage
  let collectionsPage: CollectionsPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    collectionsPage = new CollectionsPage(page)

    await loginPage.goto()
    await loginPage.login('admin@example.com', 'password123')
    await collectionsPage.goto()
  })

  test('should create collection successfully', async ({ page }) => {
    await collectionsPage.clickCreateCollection()
    await collectionsPage.fillCollectionForm({
      name: 'Test Collection',
      slug: 'test-collection',
      description: 'Test description',
    })
    await collectionsPage.submitCollectionForm()

    await expect(collectionsPage.getCollectionRow('test-collection')).toBeVisible()
  })

  test('should show error for duplicate slug', async ({ page }) => {
    await collectionsPage.clickCreateCollection()
    await collectionsPage.fillCollectionForm({
      name: 'Duplicate Collection',
      slug: 'existing-collection',
    })
    await collectionsPage.submitCollectionForm()

    await expect(page.locator('[class*="error"]')).toBeVisible()
  })

  test('should have optional description field', async ({ page }) => {
    await collectionsPage.clickCreateCollection()
    await collectionsPage.fillCollectionForm({
      name: 'No Description Collection',
      slug: 'no-desc-collection',
    })
    await collectionsPage.submitCollectionForm()

    await expect(collectionsPage.getCollectionRow('no-desc-collection')).toBeVisible()
  })

  test('should display all collections', async ({ page }) => {
    await expect(collectionsPage.getCollectionRow('test-collection')).toBeVisible()
  })

  test('should search collections', async ({ page }) => {
    await page.fill('[class*="search"], input[placeholder*="搜索"]', 'test')
    await expect(collectionsPage.getCollectionRow('test-collection')).toBeVisible()
  })

  test('should filter collections', async ({ page }) => {
    await page.selectOption('[class*="filter"], select[name="status"]', 'active')
    await expect(page.locator('[class*="collection-row"]')).toBeVisible()
  })

  test('should add field to collection', async ({ page }) => {
    const row = collectionsPage.getCollectionRow('test-collection')
    await row.locator('[class*="edit"], button:has-text("编辑")').click()

    await collectionsPage.addField({
      name: 'title',
      type: 'text',
      required: true,
    })

    await expect(collectionsPage.getFieldRow('title')).toBeVisible()
  })

  test('should configure field validation rules', async ({ page }) => {
    const row = collectionsPage.getCollectionRow('test-collection')
    await row.locator('[class*="edit"], button:has-text("编辑")').click()

    await collectionsPage.addField({
      name: 'email',
      type: 'email',
      required: true,
    })

    await expect(collectionsPage.getFieldRow('email')).toBeVisible()
  })

  test('should edit field successfully', async ({ page }) => {
    const row = collectionsPage.getCollectionRow('test-collection')
    await row.locator('[class*="edit"], button:has-text("编辑")').click()

    const fieldRow = collectionsPage.getFieldRow('title')
    await fieldRow.locator('[class*="edit"], button:has-text("编辑")').click()

    await page.fill('[name="fieldName"]', 'updatedTitle')
    await page.click('button:has-text("保存字段")')

    await expect(collectionsPage.getFieldRow('updatedTitle')).toBeVisible()
  })

  test('should delete field with confirmation', async ({ page }) => {
    await collectionsPage.deleteField('title')
    await expect(collectionsPage.getFieldRow('title')).not.toBeVisible()
  })

  test('should configure one-to-many relation', async ({ page }) => {
    const row = collectionsPage.getCollectionRow('test-collection')
    await row.locator('[class*="edit"], button:has-text("编辑")').click()

    await collectionsPage.configureRelation('one-to-many', 'users')
    await expect(page.locator('[class*="relation"]:has-text("users")')).toBeVisible()
  })

  test('should configure many-to-many relation', async ({ page }) => {
    const row = collectionsPage.getCollectionRow('test-collection')
    await row.locator('[class*="edit"], button:has-text("编辑")').click()

    await collectionsPage.configureRelation('many-to-many', 'tags')
    await expect(page.locator('[class*="relation"]:has-text("tags")')).toBeVisible()
  })

  test('should delete collection with confirmation', async ({ page }) => {
    await collectionsPage.deleteCollection('test-collection')
    await expect(collectionsPage.getCollectionRow('test-collection')).not.toBeVisible()
  })
})
