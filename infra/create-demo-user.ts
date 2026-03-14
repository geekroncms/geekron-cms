#!/usr/bin/env bun
/**
 * 创建演示用户 - 使用 Bun 内置 API
 */

const DATABASE_ID = 'e871acea-dbba-4ab4-9492-4d6b91f37d53'
const TOKEN = 'd_tGJjNmSSgAb6q8xwJqf3YWiKoOWNQcyLnOz-a0'
const ACCOUNT_ID = '645d044b57cf108ea46a1850870a827a'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'geekron-cms-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '$2a$10$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function query(sql: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  )
  
  return await response.json()
}

async function createDemoUser() {
  console.log('🚀 创建演示用户...\n')
  
  const userId = uuidv4()
  const tenantId = 'demo-tenant-001'
  const password = await hashPassword('Demo123456')
  const now = new Date().toISOString()
  
  // 创建演示用户
  const userSql = `INSERT INTO users (id, email, password, name, role, status, created_at) 
    VALUES ('${userId}', 'demo@geekron-cms.com', '${password}', '演示用户', 'owner', 'active', '${now}')`
  
  console.log('📝 创建用户...')
  const userResult = await query(userSql)
  if (userResult.success) {
    console.log('✅ 用户创建成功')
  } else {
    console.error('❌ 用户创建失败:', userResult.errors?.[0]?.message)
  }
  
  // 关联用户到租户
  const memberSql = `INSERT INTO tenant_members (id, tenant_id, user_id, role, status, created_at) 
    VALUES ('${uuidv4()}', '${tenantId}', '${userId}', 'owner', 'active', '${now}')`
  
  console.log('📝 关联租户...')
  const memberResult = await query(memberSql)
  if (memberResult.success) {
    console.log('✅ 租户关联成功')
  } else {
    console.error('❌ 租户关联失败:', memberResult.errors?.[0]?.message)
  }
  
  console.log('\n✅ 演示用户创建完成！')
  console.log('\n📋 登录信息:')
  console.log('   邮箱：demo@geekron-cms.com')
  console.log('   密码：Demo123456')
  console.log('\n🌐 访问地址：https://0e38f78a.geekron-cms-admin.pages.dev')
}

createDemoUser().catch(console.error)
