import { Page, expect } from '@playwright/test'

export class QuotasPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/quotas')
  }

  async getCurrentPlan() {
    return this.page.locator('[class*="current-plan"], [data-testid="current-plan"]').textContent()
  }

  getQuotaUsage(quotaType: string) {
    return this.page.locator(`[class*="quota-${quotaType}"]`)
  }

  getUsageProgress(quotaType: string) {
    return this.page.locator(`[class*="progress-bar"][data-type="${quotaType}"]`)
  }

  getWarningMessage() {
    return this.page.locator('[class*="warning"], [class*="alert-warning"]')
  }

  getErrorMessage() {
    return this.page.locator('[class*="error"], [class*="alert-error"]')
  }

  async upgradePlan(planName: string) {
    await this.page.click(`[class*="plan-card"]:has-text("${planName}")`)
    await this.page.click('button:has-text("确认升级"), [class*="upgrade-confirm"]')
  }

  getAvailablePlans() {
    return this.page.locator('[class*="plan-card"]')
  }

  async checkQuotaUpdated(quotaType: string, expectedValue: string) {
    await expect(this.page.locator(`[class*="quota-${quotaType}"]`)).toContainText(expectedValue)
  }
}
