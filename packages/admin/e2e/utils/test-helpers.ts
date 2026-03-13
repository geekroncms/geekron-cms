import { Page, expect } from '@playwright/test'

/**
 * 测试辅助函数库
 */

// 等待加载完成
export async function waitForLoading(page: Page) {
  await page.waitForSelector('.loading, [class*="loading"], [class*="spinner"]', {
    state: 'detached',
    timeout: 5000,
  })
}

// 填充表单
export async function fillForm(page: Page, selector: string, data: Record<string, string>) {
  for (const [key, value] of Object.entries(data)) {
    const input = page.locator(
      `${selector} [name="${key}"], ${selector} input#${key}, ${selector} textarea#${key}`,
    )
    await input.fill(value)
  }
}

// Mock API 响应
export async function mockAPI(
  page: Page,
  method: string,
  url: string,
  response: any,
  status = 200,
) {
  await page.route(`**${url}`, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

// 等待 Toast 提示
export async function waitForToast(
  page: Page,
  message: string,
  type: 'success' | 'error' = 'success',
) {
  const toastSelector =
    type === 'success'
      ? '[class*="success"], [class*="toast-success"]'
      : '[class*="error"], [class*="toast-error"]'
  await expect(page.locator(toastSelector)).toContainText(message)
}

// 检查表单验证错误
export async function checkValidationError(page: Page, fieldName: string, errorMessage: string) {
  const errorLocator = page.locator(
    `[name="${fieldName}"] + [class*="error"], [class*="error"]:has-text("${errorMessage}")`,
  )
  await expect(errorLocator).toBeVisible()
}
