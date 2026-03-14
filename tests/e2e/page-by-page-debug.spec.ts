import { test, expect } from '@playwright/test'

test.describe('Geekron CMS 逐页面详细测试', () => {
  const baseURL = 'https://b94af84d.geekron-cms-admin.pages.dev'
  
  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL)
    await page.waitForTimeout(2000)
    
    // 使用演示账号登录
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(5000)
  })

  // ========== 1. 登录页面测试 ==========
  test('01-登录页面详细测试', async ({ page }) => {
    console.log('\n=== 测试登录页面 ===')
    
    // 检查页面元素
    const title = await page.getByTestId('page-title').isVisible()
    console.log('✓ 页面标题可见:', title)
    
    const emailInput = await page.getByTestId('email-input').isVisible()
    console.log('✓ 邮箱输入框可见:', emailInput)
    
    const passwordInput = await page.getByTestId('password-input').isVisible()
    console.log('✓ 密码输入框可见:', passwordInput)
    
    const loginBtn = await page.getByTestId('login-btn').isVisible()
    console.log('✓ 登录按钮可见:', loginBtn)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-01-login.png' })
  })

  // ========== 2. 仪表盘测试 ==========
  test('02-仪表盘详细测试', async ({ page }) => {
    console.log('\n=== 测试仪表盘 ===')
    
    await page.goto(`${baseURL}/dashboard`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebar = await page.locator('.sidebar').isVisible().catch(() => false)
    console.log('侧边栏可见:', sidebar)
    
    // 检查侧边栏菜单项
    const menuItems = await page.locator('.nav-item').count()
    console.log('侧边栏菜单项数量:', menuItems)
    
    // 检查页面标题
    const pageTitle = await page.locator('[data-testid="page-title"]').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查统计卡片
    const statCards = await page.locator('.stat-card').count()
    console.log('统计卡片数量:', statCards)
    
    // 检查快速操作按钮
    const quickActions = await page.locator('.quick-actions .btn').count()
    console.log('快速操作按钮数量:', quickActions)
    
    // 测试菜单点击
    const dashboardLink = page.locator('.nav-item[href="/dashboard"]')
    await dashboardLink.click()
    await page.waitForTimeout(2000)
    console.log('✓ 仪表盘菜单点击成功')
    
    // 截图
    await page.screenshot({ path: 'test-results/page-02-dashboard.png' })
  })

  // ========== 3. 租户管理测试 ==========
  test('03-租户管理详细测试', async ({ page }) => {
    console.log('\n=== 测试租户管理 ===')
    
    await page.goto(`${baseURL}/tenants`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查表格
    const tableVisible = await page.locator('table').isVisible().catch(() => false)
    console.log('表格可见:', tableVisible)
    
    // 检查行
    const rowCount = await page.locator('tbody tr').count()
    console.log('表格行数:', rowCount)
    
    // 检查按钮
    const createBtn = await page.getByRole('button', { name: /新建 | 创建/i }).isVisible().catch(() => false)
    console.log('创建按钮可见:', createBtn)
    
    // 测试创建按钮点击
    if (createBtn) {
      await page.getByRole('button', { name: /新建 | 创建/i }).click()
      await page.waitForTimeout(2000)
      console.log('✓ 创建按钮点击成功')
    }
    
    // 截图
    await page.screenshot({ path: 'test-results/page-03-tenants.png' })
  })

  // ========== 4. 用户管理测试 ==========
  test('04-用户管理详细测试', async ({ page }) => {
    console.log('\n=== 测试用户管理 ===')
    
    await page.goto(`${baseURL}/users`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查表格
    const tableVisible = await page.locator('table').isVisible().catch(() => false)
    console.log('表格可见:', tableVisible)
    
    // 检查按钮
    const createBtn = await page.getByRole('button', { name: /新建 | 创建/i }).isVisible().catch(() => false)
    console.log('创建按钮可见:', createBtn)
    
    // 测试创建按钮点击
    if (createBtn) {
      await page.getByRole('button', { name: /新建 | 创建/i }).click()
      await page.waitForTimeout(2000)
      console.log('✓ 创建按钮点击成功')
    }
    
    // 截图
    await page.screenshot({ path: 'test-results/page-04-users.png' })
  })

  // ========== 5. 集合管理测试 ==========
  test('05-集合管理详细测试', async ({ page }) => {
    console.log('\n=== 测试集合管理 ===')
    
    await page.goto(`${baseURL}/collections`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查卡片列表
    const cardCount = await page.locator('.card').count()
    console.log('集合卡片数量:', cardCount)
    
    // 检查创建按钮
    const createBtn = await page.getByRole('button', { name: /新建 | 创建/i }).isVisible().catch(() => false)
    console.log('创建按钮可见:', createBtn)
    
    // 测试创建按钮点击
    if (createBtn) {
      await page.getByRole('button', { name: /新建 | 创建/i }).click()
      await page.waitForTimeout(2000)
      console.log('✓ 创建按钮点击成功')
    }
    
    // 截图
    await page.screenshot({ path: 'test-results/page-05-collections.png' })
  })

  // ========== 6. 文件管理测试 ==========
  test('06-文件管理详细测试', async ({ page }) => {
    console.log('\n=== 测试文件管理 ===')
    
    await page.goto(`${baseURL}/files`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查上传按钮
    const uploadBtn = await page.getByRole('button', { name: /上传|upload/i }).isVisible().catch(() => false)
    console.log('上传按钮可见:', uploadBtn)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-06-files.png' })
  })

  // ========== 7. API Key 管理测试 ==========
  test('07-API Key 管理详细测试', async ({ page }) => {
    console.log('\n=== 测试 API Key 管理 ===')
    
    await page.goto(`${baseURL}/api-keys`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查创建按钮
    const createBtn = await page.getByRole('button', { name: /新建 | 创建/i }).isVisible().catch(() => false)
    console.log('创建按钮可见:', createBtn)
    
    // 测试创建按钮点击
    if (createBtn) {
      await page.getByRole('button', { name: /新建 | 创建/i }).click()
      await page.waitForTimeout(2000)
      console.log('✓ 创建按钮点击成功')
    }
    
    // 截图
    await page.screenshot({ path: 'test-results/page-07-apikeys.png' })
  })

  // ========== 8. 配额管理测试 ==========
  test('08-配额管理详细测试', async ({ page }) => {
    console.log('\n=== 测试配额管理 ===')
    
    await page.goto(`${baseURL}/quotas`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查配额卡片
    const quotaCards = await page.locator('.card').count()
    console.log('配额卡片数量:', quotaCards)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-08-quotas.png' })
  })

  // ========== 9. 元数据管理测试 ==========
  test('09-元数据管理详细测试', async ({ page }) => {
    console.log('\n=== 测试元数据管理 ===')
    
    await page.goto(`${baseURL}/metadata`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-09-metadata.png' })
  })

  // ========== 10. 数据同步测试 ==========
  test('10-数据同步详细测试', async ({ page }) => {
    console.log('\n=== 测试数据同步 ===')
    
    await page.goto(`${baseURL}/sync`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-10-sync.png' })
  })

  // ========== 11. 设置页面测试 ==========
  test('11-设置页面详细测试', async ({ page }) => {
    console.log('\n=== 测试设置页面 ===')
    
    await page.goto(`${baseURL}/settings`)
    await page.waitForTimeout(3000)
    
    // 检查侧边栏
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    console.log('侧边栏可见:', sidebarVisible)
    
    // 检查页面标题
    const pageTitle = await page.locator('h1').textContent()
    console.log('页面标题:', pageTitle)
    
    // 检查表单
    const formVisible = await page.locator('form').isVisible()
    console.log('表单可见:', formVisible)
    
    // 检查保存按钮
    const saveBtn = await page.getByRole('button', { name: /保存|save/i }).isVisible().catch(() => false)
    console.log('保存按钮可见:', saveBtn)
    
    // 截图
    await page.screenshot({ path: 'test-results/page-11-settings.png' })
  })

  // ========== 12. 侧边栏导航测试 ==========
  test('12-侧边栏所有菜单项测试', async ({ page }) => {
    console.log('\n=== 测试侧边栏所有菜单项 ===')
    
    const menuItems = [
      { name: '仪表盘', url: '/dashboard' },
      { name: '数据模型', url: '/collections' },
      { name: '用户管理', url: '/users' },
      { name: '文件管理', url: '/files' },
      { name: 'API Keys', url: '/api-keys' },
      { name: '配额管理', url: '/quotas' },
      { name: '元数据', url: '/metadata' },
      { name: '数据同步', url: '/sync' },
      { name: '设置', url: '/settings' },
    ]

    for (const item of menuItems) {
      console.log(`\n测试菜单项：${item.name}`)
      
      await page.goto(`${baseURL}${item.url}`)
      await page.waitForTimeout(2000)
      
      const currentUrl = page.url()
      console.log(`  当前 URL: ${currentUrl}`)
      
      // 检查侧边栏是否可见
      const sidebarVisible = await page.locator('.sidebar').isVisible()
      console.log(`  侧边栏可见：${sidebarVisible}`)
      
      // 检查当前菜单项是否高亮
      const isActive = await page.locator(`.nav-item[href="${item.url}"]`).hasClass('active')
      console.log(`  菜单高亮：${isActive}`)
      
      // 截图
      await page.screenshot({ path: `test-results/menu-${item.url.replace('/', '')}.png` })
      
      console.log(`✓ ${item.name} 测试完成`)
    }
  })
})
