import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async getTenantStats() {
    return this.page.locator('[class*="tenant-stat"], [data-testid="tenant-stat"]');
  }

  async getQuickActions() {
    return this.page.locator('[class*="quick-action"], [data-testid="quick-action"]');
  }

  async getRecentActivity() {
    return this.page.locator('[class*="recent-activity"], [data-testid="recent-activity"]');
  }

  async getStatCard(title: string) {
    return this.page.locator(`[class*="stat-card"]:has-text("${title}")`);
  }

  async clickQuickAction(action: string) {
    await this.page.click(`[class*="quick-action"]:has-text("${action}")`);
  }

  async logout() {
    await this.page.click('[class*="logout"], [data-testid="logout"]');
  }

  async isLoggedIn() {
    await expect(this.page.locator('[class*="dashboard"]')).toBeVisible();
  }
}
