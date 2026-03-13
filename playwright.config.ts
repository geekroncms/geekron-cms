import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './packages/admin/tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // 手机设备
    {
      name: 'iPhone 14 Pro',
      use: { ...devices['iPhone 14 Pro'] },
    },
    {
      name: 'iPhone 14 Pro Max',
      use: { ...devices['iPhone 14 Pro Max'] },
    },
    {
      name: 'Galaxy S23',
      use: { ...devices['Galaxy S23'] },
    },
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'] },
    },

    // 平板设备
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'iPad Mini',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'Galaxy Tab S8',
      use: { ...devices['Galaxy Tab S8'] },
    },

    // 桌面设备
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },

    // 自定义分辨率测试
    {
      name: 'Desktop 1366x768',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: 'Desktop 2560x1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
      },
    },
    {
      name: 'Desktop 3840x2160',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 3840, height: 2160 },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'cd packages/admin && bun run dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
