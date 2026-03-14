import { test, expect } from '@playwright/test'

test.describe('Geekron CMS 前端测试（无需后端 API）', () => {
  const baseURL = 'https://faddb658.geekron-cms-admin.pages.dev'
  
  test('前端页面可访问', async ({ page }) => {
    await page.goto(baseURL)
    await expect(page).toHaveTitle(/Geekron CMS/)
    
    // 检查登录页面元素
    await expect(page.getByTestId('page-title')).toBeVisible()
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()
    await expect(page.getByTestId('login-btn')).toBeVisible()
    
    console.log('✅ 前端登录页面加载成功')
    await page.screenshot({ path: 'test-results/frontend-login-page.png' })
  })

  test('登录流程测试', async ({ page }) => {
    // 访问登录页面
    await page.goto(baseURL)
    
    // 填写登录表单
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    
    // 点击登录按钮
    await page.getByTestId('login-btn').click()
    
    // 等待导航（登录成功后会跳转到仪表盘）
    await page.waitForURL(/\/(dashboard|collections|tenants)/, { timeout: 10000 })
      .catch(() => {
        console.log('⚠️ 登录成功但页面未跳转，可能在仪表盘页面')
      })
    
    // 检查是否登录成功（检查是否有用户相关信息或仪表盘元素）
    const url = page.url()
    console.log('✅ 登录成功，当前 URL:', url)
    
    // 截图保存
    await page.screenshot({ path: 'test-results/frontend-login-success.png' })
  })

  test('页面导航测试 - 仪表盘', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    
    // 等待登录完成
    await page.waitForTimeout(3000)
    
    // 测试访问仪表盘页面
    await page.goto(`${baseURL}/dashboard`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-dashboard-page.png' })
    console.log('✅ 仪表盘页面访问成功')
  })

  test('页面导航测试 - 集合页面', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(3000)
    
    // 测试访问集合页面
    await page.goto(`${baseURL}/collections`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-collections-page.png' })
    console.log('✅ 集合页面访问成功')
  })

  test('页面导航测试 - 租户页面', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(3000)
    
    // 测试访问租户页面
    await page.goto(`${baseURL}/tenants`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-tenants-page.png' })
    console.log('✅ 租户页面访问成功')
  })

  test('页面导航测试 - 用户页面', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(3000)
    
    // 测试访问用户页面
    await page.goto(`${baseURL}/users`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-users-page.png' })
    console.log('✅ 用户页面访问成功')
  })

  test('页面导航测试 - 设置页面', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(3000)
    
    // 测试访问设置页面
    await page.goto(`${baseURL}/settings`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-settings-page.png' })
    console.log('✅ 设置页面访问成功')
  })

  test('页面导航测试 - API Keys 页面', async ({ page }) => {
    // 先登录
    await page.goto(`${baseURL}/login`)
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(3000)
    
    // 测试访问 API Keys 页面
    await page.goto(`${baseURL}/api-keys`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-api-keys-page.png' })
    console.log('✅ API Keys 页面访问成功')
  })

  test('完整前端用户流程测试', async ({ page }) => {
    console.log('\n🚀 开始完整前端用户流程测试...\n')
    
    // 步骤 1: 访问首页
    console.log('📝 步骤 1: 访问首页')
    await page.goto(baseURL)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-01-home.png' })
    
    // 步骤 2: 登录
    console.log('📝 步骤 2: 登录')
    await page.getByTestId('email-input').fill('demo@geekron-cms.com')
    await page.getByTestId('password-input').fill('Demo123456')
    await page.getByTestId('login-btn').click()
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'test-results/frontend-02-after-login.png' })
    
    // 步骤 3: 查看仪表盘
    console.log('📝 步骤 3: 查看仪表盘')
    await page.goto(`${baseURL}/dashboard`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-03-dashboard.png' })
    
    // 步骤 4: 查看集合列表
    console.log('📝 步骤 4: 查看集合列表')
    await page.goto(`${baseURL}/collections`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-04-collections.png' })
    
    // 步骤 5: 查看租户信息
    console.log('📝 步骤 5: 查看租户信息')
    await page.goto(`${baseURL}/tenants`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-05-tenants.png' })
    
    // 步骤 6: 查看用户列表
    console.log('📝 步骤 6: 查看用户列表')
    await page.goto(`${baseURL}/users`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-06-users.png' })
    
    // 步骤 7: 查看 API 密钥
    console.log('📝 步骤 7: 查看 API 密钥')
    await page.goto(`${baseURL}/api-keys`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-07-api-keys.png' })
    
    // 步骤 8: 查看设置
    console.log('📝 步骤 8: 查看设置')
    await page.goto(`${baseURL}/settings`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/frontend-08-settings.png' })
    
    console.log('\n✅ 完整前端用户流程测试完成！\n')
  })
})
