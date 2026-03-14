#!/usr/bin/env bun
/**
 * 初始化数据库 - 创建表和演示账号
 */

const DATABASE_ID = 'e871acea-dbba-4ab4-9492-4d6b91f37d53'
const TOKEN = 'd_tGJjNmSSgAb6q8xwJqf3YWiKoOWNQcyLnOz-a0'
const ACCOUNT_ID = '645d044b57cf108ea46a1850870a827a'

const SQLs = [
  // 创建表
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    settings TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  
  `CREATE TABLE IF NOT EXISTS tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    permissions TEXT,
    invited_by TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  
  `CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    schema TEXT,
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  
  `CREATE TABLE IF NOT EXISTS collection_data (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    permissions TEXT,
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  
  // 插入演示数据
  `INSERT OR IGNORE INTO tenants (id, name, slug, email, plan, status) 
   VALUES ('demo-tenant-001', '演示租户', 'demo', 'demo@geekron-cms.com', 'pro', 'active')`,
]

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

async function initDB() {
  console.log('🚀 开始初始化数据库...\n')
  
  for (const sql of SQLs) {
    const firstLine = sql.split('\n')[0].trim()
    console.log(`📝 执行：${firstLine.substring(0, 60)}...`)
    
    const result = await query(sql)
    
    if (result.success) {
      console.log('✅ 成功\n')
    } else {
      console.error('❌ 失败:', result.errors?.[0]?.message || result)
      console.log('')
    }
  }
  
  console.log('✅ 数据库初始化完成！')
}

initDB().catch(console.error)
