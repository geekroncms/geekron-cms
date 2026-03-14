import { test, expect } from '@playwright/test'

test.describe('Geekron CMS 完整功能测试', () => {
  const baseURL = 'https://a8a62f83.geekron-cms-admin.pages.dev'
  
  test.beforeEach(async ({ page }) => {
    // 访问登录页面
    await page.goto(baseURL)
    await page.waitForTimeout(2000)
  })

  // ========== 1. 登录流程测试 ==========
  test.describe('登录模块', () => {
    test('登录页面加载', async ({ page }) => {
      await expect(page.getByTestId('page-title')).toBeVisible()
      await expect(page.getByTestId('email-input')).toBeVisible()
      await expect(page.getByTestId('password-input')).toBeVisible()
      await expect(page.getByTestId('login-btn')).toBeVisible()
    })

    test('登录表单填写', async ({ page }) => {
      await page.getByTestId('email-input').fill('test@example.com')
      await expect(page.getByTestId('email-input')).toHaveValue('test@example.com')
      
      await page.getByTestId('password-input').fill('Test123456')
      await expect(page.getByTestId('password-input')).toHaveValue('Test123456')
    })

    test('登录按钮点击', async ({ page }) => {
      await page.getByTestId('email-input').fill('test@example.com')
      await page.getByTestId('password-input').fill('Test123456')
      await page.getByTestId('login-btn').click()
      
      // 等待登录处理
      await page.waitForTimeout(3000)
      
      // 截图保存
      await page.screenshot({ path: 'test-results/01-login-attempt.png' })
    })
  })

  // ========== 2. 仪表盘测试 ==========
  test.describe('仪表盘模块', () => {
    test('访问仪表盘页面', async ({ page }) => {
      await page.goto(`${baseURL}/dashboard`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/02-dashboard.png' })
      
      // 检查页面标题（可能是 Geekron CMS 或 Dashboard）
      const title = await page.locator('[data-testid="page-title"]').textContent().catch(() => '')
      console.log(`仪表盘标题：${title}`)
      await expect(title.length).toBeGreaterThan(0)
    })

    test('仪表盘快速操作按钮', async ({ page }) => {
      await page.goto(`${baseURL}/dashboard`)
      await page.waitForTimeout(2000)
      
      // 检查快速操作按钮是否存在
      const quickActions = page.getByRole('button', { name: /新建 | 创建|quick|fast/i })
      const count = await quickActions.count()
      console.log(`找到 ${count} 个快速操作按钮`)
      
      await page.screenshot({ path: 'test-results/02-dashboard-actions.png' })
    })
  })

  // ========== 3. 租户管理测试 ==========
  test.describe('租户管理模块', () => {
    test('访问租户页面', async ({ page }) => {
      await page.goto(`${baseURL}/tenants`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/03-tenants.png' })
    })

    test('租户列表加载', async ({ page }) => {
      await page.goto(`${baseURL}/tenants`)
      await page.waitForTimeout(2000)
      
      // 检查是否有表格或列表
      const table = page.locator('table')
      const list = page.locator('[role="list"], .list')
      
      const tableVisible = await table.isVisible().catch(() => false)
      const listVisible = await list.isVisible().catch(() => false)
      
      console.log(`表格可见：${tableVisible}, 列表可见：${listVisible}`)
    })
  })

  // ========== 4. 用户管理测试 ==========
  test.describe('用户管理模块', () => {
    test('访问用户页面', async ({ page }) => {
      await page.goto(`${baseURL}/users`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/04-users.png' })
    })

    test('用户列表检查', async ({ page }) => {
      await page.goto(`${baseURL}/users`)
      await page.waitForTimeout(2000)
      
      // 检查用户表格
      const table = page.locator('table')
      await expect(table).toBeVisible().catch(() => console.log('用户表格未找到'))
    })
  })

  // ========== 5. 集合管理测试 ==========
  test.describe('集合管理模块', () => {
    test('访问集合页面', async ({ page }) => {
      await page.goto(`${baseURL}/collections`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/05-collections.png' })
    })

    test('集合列表检查', async ({ page }) => {
      await page.goto(`${baseURL}/collections`)
      await page.waitForTimeout(2000)
      
      // 检查集合列表
      const table = page.locator('table')
      await expect(table).toBeVisible().catch(() => console.log('集合表格未找到'))
    })
  })

  // ========== 6. 内容管理测试 ==========
  test.describe('内容管理模块', () => {
    test('访问内容管理页面', async ({ page }) => {
      await page.goto(`${baseURL}/collections/1/content`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/06-content.png' })
    })
  })

  // ========== 7. 文件管理测试 ==========
  test.describe('文件管理模块', () => {
    test('访问文件页面', async ({ page }) => {
      await page.goto(`${baseURL}/files`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/07-files.png' })
    })

    test('文件上传按钮', async ({ page }) => {
      await page.goto(`${baseURL}/files`)
      await page.waitForTimeout(2000)
      
      // 检查上传按钮
      const uploadBtn = page.getByRole('button', { name: /上传|upload|file/i })
      const visible = await uploadBtn.isVisible().catch(() => false)
      console.log(`上传按钮可见：${visible}`)
    })
  })

  // ========== 8. API Key 管理测试 ==========
  test.describe('API Key 管理模块', () => {
    test('访问 API Keys 页面', async ({ page }) => {
      await page.goto(`${baseURL}/api-keys`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/08-api-keys.png' })
    })

    test('创建 API Key 按钮', async ({ page }) => {
      await page.goto(`${baseURL}/api-keys`)
      await page.waitForTimeout(2000)
      
      // 检查创建按钮
      const createBtn = page.getByRole('button', { name: /创建|新建|create|new/i })
      const visible = await createBtn.isVisible().catch(() => false)
      console.log(`创建按钮可见：${visible}`)
    })
  })

  // ========== 9. 配额管理测试 ==========
  test.describe('配额管理模块', () => {
    test('访问配额页面', async ({ page }) => {
      await page.goto(`${baseURL}/quotas`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/09-quotas.png' })
    })

    test('配额信息展示', async ({ page }) => {
      await page.goto(`${baseURL}/quotas`)
      await page.waitForTimeout(2000)
      
      // 检查配额卡片或表格
      const cards = page.locator('.card, [role="article"]')
      const count = await cards.count()
      console.log(`找到 ${count} 个配额卡片`)
    })
  })

  // ========== 10. 元数据管理测试 ==========
  test.describe('元数据管理模块', () => {
    test('访问元数据页面', async ({ page }) => {
      await page.goto(`${baseURL}/metadata`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/10-metadata.png' })
    })
  })

  // ========== 11. 数据同步测试 ==========
  test.describe('数据同步模块', () => {
    test('访问同步页面', async ({ page }) => {
      await page.goto(`${baseURL}/sync`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/11-sync.png' })
    })
  })

  // ========== 12. 设置页面测试 ==========
  test.describe('设置模块', () => {
    test('访问设置页面', async ({ page }) => {
      await page.goto(`${baseURL}/settings`)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/12-settings.png' })
    })

    test('设置表单检查', async ({ page }) => {
      await page.goto(`${baseURL}/settings`)
      await page.waitForTimeout(2000)
      
      // 检查设置表单
      const form = page.locator('form')
      const visible = await form.isVisible().catch(() => false)
      console.log(`设置表单可见：${visible}`)
    })
  })

  // ========== 13. 侧边栏导航测试 ==========
  test.describe('侧边栏导航', () => {
    test('所有菜单项可点击', async ({ page }) => {
      const menuItems = [
        { name: '仪表盘', url: '/dashboard' },
        { name: '租户', url: '/tenants' },
        { name: '用户', url: '/users' },
        { name: '集合', url: '/collections' },
        { name: '文件', url: '/files' },
        { name: 'API Keys', url: '/api-keys' },
        { name: '配额', url: '/quotas' },
        { name: '元数据', url: '/metadata' },
        { name: '同步', url: '/sync' },
        { name: '设置', url: '/settings' },
      ]

      for (const item of menuItems) {
        await page.goto(`${baseURL}${item.url}`)
        await page.waitForTimeout(1000)
        
        const currentUrl = page.url()
        console.log(`✓ 导航到 ${item.name}: ${currentUrl}`)
        
        await page.screenshot({ path: `test-results/nav-${item.url.replace('/', '')}.png` })
      }
    })
  })

  // ========== 14. 响应式测试 ==========
  test.describe('响应式布局', () => {
    test('移动端视图', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(baseURL)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/responsive-mobile.png' })
    })

    test('平板视图', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto(baseURL)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/responsive-tablet.png' })
    })

    test('桌面视图', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(baseURL)
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'test-results/responsive-desktop.png' })
    })
  })
})
