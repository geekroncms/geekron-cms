import { Page } from '@playwright/test'

export class ApiKeysPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/api-keys')
  }

  async clickCreateKey() {
    await this.page.click('button:has-text("创建 API Key"), [class*="create-key"]')
  }

  async fillKeyForm(data: { name: string; permissions?: string[]; expiresAt?: string }) {
    await this.page.fill('[name="name"]', data.name)
    if (data.permissions) {
      for (const perm of data.permissions) {
        await this.page.check(`[name="permissions"][value="${perm}"]`)
      }
    }
    if (data.expiresAt) {
      await this.page.fill('[name="expiresAt"]', data.expiresAt)
    }
  }

  async submitKeyForm() {
    await this.page.click('button[type="submit"]')
  }

  async getGeneratedKey() {
    return this.page
      .locator('[class*="api-key-display"], [data-testid="generated-key"]')
      .textContent()
  }

  async copyKey() {
    await this.page.click('[class*="copy-key"], button:has-text("复制")')
  }

  getKeyRow(name: string) {
    return this.page.locator(`[class*="api-key-row"]:has-text("${name}")`)
  }

  async rotateKey(name: string) {
    const row = await this.getKeyRow(name)
    await row.locator('[class*="rotate"], button:has-text("轮换")').click()
    await this.page.click('[class*="confirm"], button:has-text("确认")')
  }

  async deleteKey(name: string) {
    const row = await this.getKeyRow(name)
    await row.locator('[class*="delete"], button:has-text("删除")').click()
    await this.page.click('[class*="confirm"], button:has-text("确认")')
  }

  async getKeyPermissions(name: string) {
    const row = await this.getKeyRow(name)
    return row.locator('[class*="permissions"]').textContent()
  }
}
