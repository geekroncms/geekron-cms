import { Page, expect } from '@playwright/test';

export class CollectionsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/collections');
  }

  async clickCreateCollection() {
    await this.page.click('button:has-text("创建模型"), [class*="create-collection"]');
  }

  async fillCollectionForm(data: { name: string; slug: string; description?: string }) {
    await this.page.fill('[name="name"]', data.name);
    await this.page.fill('[name="slug"]', data.slug);
    if (data.description) {
      await this.page.fill('[name="description"]', data.description);
    }
  }

  async submitCollectionForm() {
    await this.page.click('button[type="submit"]');
  }

  async addField(fieldData: { name: string; type: string; required?: boolean }) {
    await this.page.click('button:has-text("添加字段"), [class*="add-field"]');
    await this.page.fill('[name="fieldName"]', fieldData.name);
    await this.page.selectOption('[name="fieldType"]', fieldData.type);
    if (fieldData.required) {
      await this.page.check('[name="required"]');
    }
    await this.page.click('button:has-text("保存字段")');
  }

  async getFieldRow(fieldName: string) {
    return this.page.locator(`[class*="field-row"]:has-text("${fieldName}")`);
  }

  async deleteField(fieldName: string) {
    const row = this.getFieldRow(fieldName);
    await row.locator('[class*="delete"], button:has-text("删除")').click();
    await this.page.click('[class*="confirm"], button:has-text("确认")');
  }

  async getCollectionRow(slug: string) {
    return this.page.locator(`[class*="collection-row"]:has-text("${slug}")`);
  }

  async deleteCollection(slug: string) {
    const row = this.getCollectionRow(slug);
    await row.locator('[class*="delete"], button:has-text("删除")').click();
    await this.page.click('[class*="confirm"], button:has-text("确认")');
  }

  async configureRelation(type: 'one-to-many' | 'many-to-many', targetCollection: string) {
    await this.page.selectOption('[name="relationType"]', type);
    await this.page.selectOption('[name="targetCollection"]', targetCollection);
    await this.page.click('button:has-text("保存关系")');
  }
}
