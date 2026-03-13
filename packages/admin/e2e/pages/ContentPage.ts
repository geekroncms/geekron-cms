import { Page } from '@playwright/test'

export class ContentPage {
  constructor(private page: Page) {}

  async goto(collectionSlug: string) {
    await this.page.goto(`/content/${collectionSlug}`)
  }

  async clickCreateContent() {
    await this.page.click('button:has-text("创建内容"), [class*="create-content"]')
  }

  async fillContentForm(data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      await this.page.fill(`[name="${key}"]`, value)
    }
  }

  async submitContentForm() {
    await this.page.click('button[type="submit"]')
  }

  getContentRow(contentId: string) {
    return this.page.locator(`[class*="content-row"]:has-text("${contentId}")`)
  }

  async editContent(contentId: string) {
    const row = await this.getContentRow(contentId)
    await row.locator('[class*="edit"], button:has-text("编辑")').click()
  }

  async deleteContent(contentId: string) {
    const row = await this.getContentRow(contentId)
    await row.locator('[class*="delete"], button:has-text("删除")').click()
    await this.page.click('[class*="confirm"], button:has-text("确认")')
  }

  async selectContent(contentId: string) {
    const row = await this.getContentRow(contentId)
    await row.locator('[type="checkbox"]').check()
  }

  async bulkDelete() {
    await this.page.click('button:has-text("批量删除"), [class*="bulk-delete"]')
    await this.page.click('[class*="confirm"], button:has-text("确认")')
  }

  async searchContent(keyword: string) {
    await this.page.fill('[class*="search"], input[placeholder*="搜索"]', keyword)
  }

  async sortBy(field: string) {
    await this.page.click(`[class*="sort"]:has-text("${field}")`)
  }
}
