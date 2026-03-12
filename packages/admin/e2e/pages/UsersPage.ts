import { Page, expect } from '@playwright/test';

export class UsersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/users');
  }

  async clickCreateUser() {
    await this.page.click('button:has-text("创建用户"), [class*="create-user"]');
  }

  async fillUserForm(data: { email: string; name: string; password?: string; role?: string }) {
    await this.page.fill('[name="email"]', data.email);
    await this.page.fill('[name="name"]', data.name);
    if (data.password) {
      await this.page.fill('[name="password"]', data.password);
    }
    if (data.role) {
      await this.page.selectOption('[name="role"]', data.role);
    }
  }

  async submitUserForm() {
    await this.page.click('button[type="submit"]');
  }

  async getUserRow(email: string) {
    return this.page.locator(`[class*="user-row"]:has-text("${email}")`);
  }

  async editUser(email: string) {
    const row = this.getUserRow(email);
    await row.locator('[class*="edit"], button:has-text("编辑")').click();
  }

  async deleteUser(email: string) {
    const row = this.getUserRow(email);
    await row.locator('[class*="delete"], button:has-text("删除")').click();
    await this.page.click('[class*="confirm"], button:has-text("确认")');
  }

  async toggleUserStatus(email: string) {
    const row = this.getUserRow(email);
    await row.locator('[class*="toggle"], [class*="switch"]').click();
  }

  async assignRole(email: string, role: string) {
    const row = this.getUserRow(email);
    await row.locator('[class*="role-select"]').selectOption(role);
  }
}
