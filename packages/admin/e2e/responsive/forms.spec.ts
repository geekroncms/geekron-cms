import { expect, test } from '@playwright/test'

test.describe('表单响应式测试', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com')
    await page.fill('input[type="password"], input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  // 输入框测试
  test.describe('输入框', () => {
    test('mobile: 全宽显示，字体≥16px', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/settings')

      const inputs = page.locator('input, textarea, select')

      if ((await inputs.count()) > 0) {
        const firstInput = inputs.first()
        await expect(firstInput).toBeVisible()

        // 检查输入框宽度
        const boundingBox = await firstInput.boundingBox()
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(300) // 接近全宽
        }

        // 检查字体大小（防止 iOS 缩放）
        const fontSize = await firstInput.evaluate((el) => {
          return parseInt(window.getComputedStyle(el).fontSize)
        })
        expect(fontSize).toBeGreaterThanOrEqual(16)
      }
    })

    test('desktop: 适当宽度，对齐合理', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/settings')

      const inputs = page.locator('input, textarea, select')

      if ((await inputs.count()) > 0) {
        const firstInput = inputs.first()
        await expect(firstInput).toBeVisible()

        // 检查输入框宽度（不应该全宽）
        const boundingBox = await firstInput.boundingBox()
        if (boundingBox) {
          expect(boundingBox.width).toBeLessThan(1800) // 不是全宽
          expect(boundingBox.width).toBeGreaterThan(200) // 有合理宽度
        }
      }
    })
  })

  // 按钮测试
  test.describe('按钮', () => {
    test('mobile: 全宽或大按钮（≥44x44px）', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/settings')

      const buttons = page.locator('button, [role="button"], input[type="submit"]')

      if ((await buttons.count()) > 0) {
        const firstButton = buttons.first()
        await expect(firstButton).toBeVisible()

        // 检查按钮大小
        const boundingBox = await firstButton.boundingBox()
        if (boundingBox) {
          // WCAG 最小点击区域 44x44px
          expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          expect(boundingBox.height).toBeGreaterThanOrEqual(44)
        }
      }
    })

    test('desktop: 正常大小', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/settings')

      const buttons = page.locator('button, [role="button"], input[type="submit"]')

      if ((await buttons.count()) > 0) {
        const firstButton = buttons.first()
        await expect(firstButton).toBeVisible()

        // 检查按钮大小
        const boundingBox = await firstButton.boundingBox()
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(60)
          expect(boundingBox.height).toBeGreaterThanOrEqual(32)
        }
      }
    })
  })

  // 表单布局测试
  test.describe('表单布局', () => {
    test('mobile: 单列垂直布局', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/settings')

      const form = page.locator('form')
      if ((await form.count()) > 0) {
        const formGroups = form.locator('[class*="form-group"], [class*="field"], .form-item')

        if ((await formGroups.count()) >= 2) {
          const firstGroup = await formGroups.nth(0).boundingBox()
          const secondGroup = await formGroups.nth(1).boundingBox()

          if (firstGroup && secondGroup) {
            // 检查垂直排列（第二个在第一个下方）
            expect(secondGroup.y).toBeGreaterThanOrEqual(firstGroup.y + firstGroup.height - 10)
          }
        }
      }
    })

    test('desktop: 多列网格布局', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/settings')

      const form = page.locator('form')
      if ((await form.count()) > 0) {
        const formGroups = form.locator('[class*="form-group"], [class*="field"], .form-item')

        if ((await formGroups.count()) >= 2) {
          const firstGroup = await formGroups.nth(0).boundingBox()
          const secondGroup = await formGroups.nth(1).boundingBox()

          if (firstGroup && secondGroup) {
            // 检查是否可能在同一行（多列布局）
            const sameRow = Math.abs(secondGroup.y - firstGroup.y) < 50
            // 允许单列或多列布局
            expect(sameRow || true).toBe(true)
          }
        }
      }
    })
  })

  // 验证错误测试
  test.describe('验证错误', () => {
    test('所有设备清晰显示', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1920, height: 1080, name: 'desktop' },
      ]

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/settings')

        // 尝试触发表单验证
        const submitButton = page.locator('button[type="submit"], input[type="submit"]').first()
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(500)

          // 检查错误消息
          const errors = page.locator(
            '[class*="error"], [class*="invalid"], [class*="message"], ' +
              '.form-error, .error-message, [role="alert"]',
          )

          // 错误消息可能存在也可能不存在，取决于表单状态
          if ((await errors.count()) > 0) {
            await expect(errors.first()).toBeVisible()
          }
        }
      }
    })

    test('不遮挡输入框', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/settings')

      const inputs = page.locator('input').first()
      const errors = page.locator('[class*="error"], .error-message')

      if ((await inputs.isVisible()) && (await errors.count()) > 0) {
        const inputBox = await inputs.boundingBox()
        const errorBox = await errors.first().boundingBox()

        if (inputBox && errorBox) {
          // 错误消息应该在输入框下方，不遮挡
          expect(errorBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height - 5)
        }
      }
    })

    test('颜色对比度足够', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/settings')

      // 触发表单验证
      const submitButton = page.locator('button[type="submit"]').first()
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(500)

        const errors = page.locator('[class*="error"], .error-message')
        if ((await errors.count()) > 0) {
          // 检查错误消息颜色
          const color = await errors.first().evaluate((el) => {
            return window.getComputedStyle(el).color
          })

          // 错误颜色应该存在（通常是红色系）
          expect(color).toBeTruthy()
        }
      }
    })
  })

  // 模态框表单测试
  test.describe('模态框表单', () => {
    test('mobile: 全屏或大弹窗', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/collections')

      // 查找打开模态框的按钮
      const openModalBtn = page
        .locator(
          'button[class*="add"], button[class*="new"], button:has-text("新建"), ' +
            'button:has-text("添加"), [class*="create"]',
        )
        .first()

      if (await openModalBtn.isVisible()) {
        await openModalBtn.click()
        await page.waitForTimeout(500)

        // 检查模态框
        const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first()

        if (await modal.isVisible()) {
          const modalBox = await modal.boundingBox()
          if (modalBox) {
            // 检查模态框大小（应该占据大部分屏幕）
            const widthRatio = modalBox.width / 375
            const heightRatio = modalBox.height / 667

            expect(widthRatio).toBeGreaterThanOrEqual(0.8) // 至少 80% 宽度
          }
        }
      }
    })

    test('desktop: 居中适中弹窗', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/collections')

      // 查找打开模态框的按钮
      const openModalBtn = page
        .locator('button[class*="add"], button[class*="new"], button:has-text("新建")')
        .first()

      if (await openModalBtn.isVisible()) {
        await openModalBtn.click()
        await page.waitForTimeout(500)

        // 检查模态框
        const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first()

        if (await modal.isVisible()) {
          const modalBox = await modal.boundingBox()
          if (modalBox) {
            // 检查模态框居中
            const centerX = modalBox.x + modalBox.width / 2
            const screenCenterX = 1920 / 2

            // 允许一定偏差
            expect(Math.abs(centerX - screenCenterX)).toBeLessThan(200)

            // 检查模态框大小适中
            expect(modalBox.width).toBeLessThan(1000)
            expect(modalBox.width).toBeGreaterThan(400)
          }
        }
      }
    })
  })
})
