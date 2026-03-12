import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...defineConfig().use,
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox',
      use: { 
        ...defineConfig().use,
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...defineConfig().use,
        viewport: { width: 1920, height: 1080 },
      },
    },
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { 
        ...defineConfig().use,
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...defineConfig().use,
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
      },
    },
    {
      name: 'iPad',
      use: { 
        ...defineConfig().use,
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
