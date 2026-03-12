import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }

  async getEmailInput() {
    return this.page.locator('[name="email"]');
  }

  async getPasswordInput() {
    return this.page.locator('[name="password"]');
  }

  async getSubmitButton() {
    return this.page.locator('button[type="submit"]');
  }

  async getErrorMessage() {
    return this.page.locator('[class*="error"], .error-message').textContent();
  }

  async hasValidationError(field: string) {
    const error = this.page.locator(`[name="${field}"] + [class*="error"]`);
    return error.isVisible();
  }

  async isLoggedIn() {
    await expect(this.page).toHaveURL(/\/dashboard|\/$/);
  }
}
