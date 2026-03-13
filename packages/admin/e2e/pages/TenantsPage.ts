import { Page } from '@playwright/test'

export class TenantsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/tenants')
  }

  async clickCreateTenant() {
    await this.page.click('[class*="create-tenant"], button:has-text("创建租户")')
  }

  async fillTenantForm(data: { name: string; subdomain: string; description?: string }) {
    await this.page.fill('[name="name"]', data.name)
    await this.page.fill('[name="subdomain"]', data.subdomain)
    if (data.description) {
      await this.page.fill('[name="description"]', data.description)
    }
  }

  async submitTenantForm() {
    await this.page.click('button[type="submit"]')
  }

  async getSubdomainStatus() {
    return this.page.locator('[class*="subdomain-status"]').textContent()
  }

  getTenantRow(name: string) {
    return this.page.locator(`[class*="tenant-row"]:has-text("${name}")`)
  }

  async editTenant(name: string) {
    const row = await this.getTenantRow(name)
    await row.locator('[class*="edit"], button:has-text("编辑")').click()
  }

  async deleteTenant(name: string) {
    const row = await this.getTenantRow(name)
    await row.locator('[class*="delete"], button:has-text("删除")').click()
    // 确认删除
    await this.page.click('[class*="confirm-delete"], button:has-text("确认删除")')
  }

  async searchTenant(keyword: string) {
    await this.page.fill('[class*="search-input"], input[placeholder*="搜索"]', keyword)
  }

  async getPagination() {
    return this.page.locator('[class*="pagination"]')
  }

  async goToPage(pageNum: number) {
    await this.page.click(`[class*="pagination"] button:has-text("${pageNum}")`)
  }
}
