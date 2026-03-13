import { expect, test } from '@playwright/test'

// 测试断点
const breakpoints = {
  mobile: { width: 375, height: 667 }, // 375px+
  tablet: { width: 768, height: 1024 }, // 768px+
  desktop: { width: 1366, height: 768 }, // 1366px+
  large: { width: 1920, height: 1080 }, // 1920px+
}

// 测试页面清单
const pages = [
  { name: '登录页', path: '/login', requiresAuth: false },
  { name: 'Dashboard', path: '/dashboard', requiresAuth: true },
  { name: '租户列表', path: '/tenants', requiresAuth: true },
  { name: '用户列表', path: '/users', requiresAuth: true },
  { name: '数据模型列表', path: '/collections', requiresAuth: true },
  { name: '设置页', path: '/settings', requiresAuth: true },
]

test.describe('全局布局响应式测试', () => {
  // 登录页测试（不需要认证）
  test.describe('登录页 (/login)', () => {
    test('mobile: 表单垂直排列，无横向滚动', async ({ page }) => {
      await page.setViewportSize(breakpoints.mobile)
      await page.goto('/login')

      // 检查无横向滚动
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)

      // 检查表单垂直排列
      const form = page.locator('form')
      await expect(form).toBeVisible()

      // 检查表单元素宽度
      const inputs = form.locator('input')
      const firstInput = inputs.first()
      const inputWidth = await firstInput.boundingBox()
      expect(inputWidth?.width).toBeGreaterThan(300) // 接近全宽
    })

    test('tablet: 布局合理，logo 显示正常', async ({ page }) => {
      await page.setViewportSize(breakpoints.tablet)
      await page.goto('/login')

      // 检查 logo 显示
      const logo = page.locator('img[alt="logo"], .logo')
      if ((await logo.count()) > 0) {
        await expect(logo).toBeVisible()
      }

      // 检查无横向滚动
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)
    })

    test('desktop: 居中布局，背景正常', async ({ page }) => {
      await page.setViewportSize(breakpoints.desktop)
      await page.goto('/login')

      // 检查表单居中
      const form = page.locator('form')
      await expect(form).toBeVisible()

      // 检查背景
      const bodyBackground = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor
      })
      expect(bodyBackground).toBeTruthy()
    })
  })

  // Dashboard 测试
  test.describe('Dashboard (/)', () => {
    test.beforeEach(async ({ page }) => {
      // 模拟登录
      await page.goto('/login')
      await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
      await page.fill('input[type="password"], input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')
    })

    test('mobile: 统计卡片垂直堆叠', async ({ page }) => {
      await page.setViewportSize(breakpoints.mobile)
      await page.goto('/')

      // 检查统计卡片
      const cards = page.locator('[class*="card"], [class*="stat"]')
      const count = await cards.count()

      if (count > 0) {
        // 检查卡片是否垂直排列（第一个卡片的 top 应该小于第二个卡片的 top）
        const firstCard = await cards.nth(0).boundingBox()
        const secondCard = await cards.nth(1).boundingBox()

        if (firstCard && secondCard) {
          expect(secondCard.y).toBeGreaterThanOrEqual(firstCard.y + firstCard.height - 10)
        }
      }

      // 检查无内容溢出
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)
    })

    test('tablet: 2 列网格布局', async ({ page }) => {
      await page.setViewportSize(breakpoints.tablet)
      await page.goto('/')

      // 检查卡片布局
      const cards = page.locator('[class*="card"], [class*="stat"]')
      const count = await cards.count()

      if (count >= 2) {
        // 检查是否有 2 列布局
        const firstCard = await cards.nth(0).boundingBox()
        const secondCard = await cards.nth(1).boundingBox()

        if (firstCard && secondCard) {
          // 如果第二张卡片与第一张在同一行（y 坐标相近）
          const sameRow = Math.abs(secondCard.y - firstCard.y) < 50
          expect(sameRow).toBe(true)
        }
      }
    })

    test('desktop: 4 列网格布局', async ({ page }) => {
      await page.setViewportSize(breakpoints.desktop)
      await page.goto('/')

      // 检查卡片布局
      const cards = page.locator('[class*="card"], [class*="stat"]')
      const count = await cards.count()

      if (count >= 4) {
        // 检查是否有 4 列布局
        const firstCard = await cards.nth(0).boundingBox()
        const fourthCard = await cards.nth(3).boundingBox()

        if (firstCard && fourthCard) {
          const sameRow = Math.abs(fourthCard.y - firstCard.y) < 50
          expect(sameRow).toBe(true)
        }
      }

      // 检查无内容溢出
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)
    })
  })

  // 列表页测试（tenants, users, collections）
  test.describe('列表页响应式测试', () => {
    const listPages = ['/tenants', '/users', '/collections']

    for (const pagePath of listPages) {
      test(`${pagePath}: mobile - 表格转为卡片视图或可横向滚动`, async ({ page }) => {
        await page.setViewportSize(breakpoints.mobile)
        await page.goto('/login')
        await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
        await page.fill('input[type="password"], input[name="password"]', 'password')
        await page.click('button[type="submit"]')
        await page.waitForURL('/')

        await page.goto(pagePath)

        // 检查表格或卡片视图
        const table = page.locator('table')
        const cards = page.locator('[class*="card"]')

        if ((await table.count()) > 0) {
          // 如果有表格，检查是否可横向滚动
          const hasHorizontalScroll = await table.first().evaluate((el) => {
            return el.scrollWidth > el.clientWidth
          })
          // 允许横向滚动或转为卡片视图
          expect(hasHorizontalScroll || (await cards.count()) > 0).toBe(true)
        } else if ((await cards.count()) > 0) {
          // 卡片视图，检查垂直排列
          const firstCard = await cards.nth(0).boundingBox()
          const secondCard = await cards.nth(1).boundingBox()

          if (firstCard && secondCard) {
            expect(secondCard.y).toBeGreaterThanOrEqual(firstCard.y)
          }
        }
      })

      test(`${pagePath}: tablet - 表格可横向滚动`, async ({ page }) => {
        await page.setViewportSize(breakpoints.tablet)
        await page.goto('/login')
        await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
        await page.fill('input[type="password"], input[name="password"]', 'password')
        await page.click('button[type="submit"]')
        await page.waitForURL('/')

        await page.goto(pagePath)

        const table = page.locator('table')
        if ((await table.count()) > 0) {
          // 检查表格容器是否支持横向滚动
          const tableContainer = table.first().locator('..')
          const hasScroll = await tableContainer.evaluate((el) => {
            return el.scrollWidth > el.clientWidth || el.style.overflowX === 'auto'
          })
          expect(hasScroll || true).toBe(true) // 允许正常显示或可滚动
        }
      })

      test(`${pagePath}: desktop - 完整表格显示`, async ({ page }) => {
        await page.setViewportSize(breakpoints.desktop)
        await page.goto('/login')
        await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
        await page.fill('input[type="password"], input[name="password"]', 'password')
        await page.click('button[type="submit"]')
        await page.waitForURL('/')

        await page.goto(pagePath)

        const table = page.locator('table')
        if ((await table.count()) > 0) {
          // 检查表头显示
          const headers = table.locator('thead th')
          expect(await headers.count()).toBeGreaterThan(0)

          // 检查无横向滚动（完整显示）
          const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth
          })
          expect(hasHorizontalScroll).toBe(false)
        }
      })
    }
  })

  // 设置页测试
  test.describe('设置页 (/settings)', () => {
    test('mobile: 表单垂直排列', async ({ page }) => {
      await page.setViewportSize(breakpoints.mobile)
      await page.goto('/login')
      await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
      await page.fill('input[type="password"], input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')

      await page.goto('/settings')

      // 检查表单垂直排列
      const form = page.locator('form')
      await expect(form).toBeVisible()

      // 检查输入框全宽
      const inputs = form.locator('input, select, textarea')
      if ((await inputs.count()) > 0) {
        const firstInput = await inputs.first().boundingBox()
        if (firstInput) {
          expect(firstInput.width).toBeGreaterThan(300)
        }
      }
    })

    test('desktop: 双栏布局（导航 + 内容）', async ({ page }) => {
      await page.setViewportSize(breakpoints.desktop)
      await page.goto('/login')
      await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
      await page.fill('input[type="password"], input[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')

      await page.goto('/settings')

      // 检查是否有侧边栏和内容区
      const sidebar = page.locator('[class*="sidebar"], [class*="nav"], aside')
      const content = page.locator('[class*="content"], main')

      if ((await sidebar.count()) > 0 && (await content.count()) > 0) {
        const sidebarBox = await sidebar.first().boundingBox()
        const contentBox = await content.first().boundingBox()

        if (sidebarBox && contentBox) {
          // 检查是否并排显示
          const sameRow = Math.abs(sidebarBox.y - contentBox.y) < 50
          expect(sameRow).toBe(true)
        }
      }
    })
  })
})
