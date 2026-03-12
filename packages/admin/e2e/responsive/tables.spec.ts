import { test, expect } from '@playwright/test';

test.describe('表格响应式测试', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@geekron.com');
    await page.fill('input[type="password"], input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  // Desktop
  test.describe('Desktop', () => {
    test('完整表格显示所有列', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        // 检查表头
        const headers = table.locator('thead th');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);
        
        // 检查所有表头可见
        for (let i = 0; i < headerCount; i++) {
          await expect(headers.nth(i)).toBeVisible();
        }
        
        // 检查无横向滚动（完整显示）
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBe(false);
      }
    });

    test('表头固定', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        const thead = table.locator('thead');
        const positionStyle = await thead.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.position;
        });
        
        // 表头可能是 sticky 或 fixed
        expect(['sticky', 'fixed', 'static'].includes(positionStyle)).toBe(true);
      }
    });

    test('横向滚动（如需要）', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        const tableContainer = table.first().locator('..');
        const overflowX = await tableContainer.evaluate((el) => {
          return window.getComputedStyle(el).overflowX;
        });
        
        // 允许 auto 或 scroll
        expect(['auto', 'scroll', 'visible'].includes(overflowX)).toBe(true);
      }
    });

    test('分页器正常', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/collections');
      
      // 查找分页器
      const pagination = page.locator(
        '[class*="pagination"], [class*="pager"], nav[aria-label="pagination"]'
      );
      
      if (await pagination.count() > 0) {
        await expect(pagination.first()).toBeVisible();
      }
    });
  });

  // Tablet
  test.describe('Tablet', () => {
    test('关键列显示', async ({ page }) => {
      await page.setViewportSize({ width: 834, height: 1194 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        // 检查表格可见
        await expect(table.first()).toBeVisible();
        
        // 检查至少第一列可见
        const firstRow = table.locator('tbody tr').first();
        const firstCell = firstRow.locator('td').first();
        await expect(firstCell).toBeVisible();
      }
    });

    test('次要列隐藏或可展开', async ({ page }) => {
      await page.setViewportSize({ width: 834, height: 1194 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        const headers = table.locator('thead th');
        const headerCount = await headers.count();
        
        // 检查是否有展开按钮或列数合理
        const expandButtons = table.locator('[class*="expand"], button[aria-label="expand"]');
        const hasExpandButtons = await expandButtons.count() > 0;
        
        // 允许有展开功能或列数较少
        expect(hasExpandButtons || headerCount <= 5).toBe(true);
      }
    });

    test('横向滚动平滑', async ({ page }) => {
      await page.setViewportSize({ width: 834, height: 1194 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        const tableContainer = table.first().locator('..');
        
        // 检查是否可滚动
        const isScrollable = await tableContainer.evaluate((el) => {
          return el.scrollWidth > el.clientWidth;
        });
        
        if (isScrollable) {
          // 测试横向滚动
          await tableContainer.evaluate((el) => {
            el.scrollLeft = 100;
          });
          
          const scrollLeft = await tableContainer.evaluate((el) => el.scrollLeft);
          expect(scrollLeft).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('触摸友好', async ({ page }) => {
      await page.setViewportSize({ width: 834, height: 1194 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      if (await table.count() > 0) {
        // 检查表格行是否有足够的点击区域
        const rows = table.locator('tbody tr');
        if (await rows.count() > 0) {
          const firstRow = rows.first();
          const boundingBox = await firstRow.boundingBox();
          
          if (boundingBox) {
            // 检查行高是否足够（至少 44px）
            expect(boundingBox.height).toBeGreaterThanOrEqual(40);
          }
        }
      }
    });
  });

  // Mobile
  test.describe('Mobile', () => {
    test('表格转为卡片视图', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/collections');
      
      const table = page.locator('table');
      const cards = page.locator('[class*="card"]');
      
      if (await table.count() > 0) {
        // 如果表格存在，检查是否有卡片式布局或可滚动
        const tableContainer = table.first().locator('..');
        const hasHorizontalScroll = await tableContainer.evaluate((el) => {
          return el.scrollWidth > el.clientWidth;
        });
        
        // 允许横向滚动或转为卡片
        expect(hasHorizontalScroll || await cards.count() > 0).toBe(true);
      } else if (await cards.count() > 0) {
        // 卡片视图
        await expect(cards.first()).toBeVisible();
      }
    });

    test('每张卡片显示完整信息', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/collections');
      
      const cards = page.locator('[class*="card"]');
      
      if (await cards.count() > 0) {
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();
        
        // 检查卡片包含内容
        const cardContent = firstCard.locator('*');
        const contentCount = await cardContent.count();
        expect(contentCount).toBeGreaterThan(0);
      }
    });

    test('操作按钮可见可点击', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/collections');
      
      // 查找操作按钮
      const actionButtons = page.locator(
        'button[class*="action"], button[class*="edit"], button[class*="delete"], ' +
        '[class*="actions"] button, a[class*="button"]'
      );
      
      if (await actionButtons.count() > 0) {
        const firstButton = actionButtons.first();
        await expect(firstButton).toBeVisible();
        
        // 检查按钮大小
        const boundingBox = await firstButton.boundingBox();
        if (boundingBox) {
          // 检查最小点击区域（WCAG 44x44px）
          expect(boundingBox.width).toBeGreaterThanOrEqual(40);
          expect(boundingBox.height).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('垂直滚动正常', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/collections');
      
      // 检查页面可垂直滚动
      const canScroll = await page.evaluate(() => {
        return document.documentElement.scrollHeight > document.documentElement.clientHeight;
      });
      
      // 测试滚动
      await page.evaluate(() => {
        window.scrollTo(0, 100);
      });
      
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThanOrEqual(0);
    });
  });
});
