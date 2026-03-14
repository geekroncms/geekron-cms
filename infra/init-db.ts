#!/usr/bin/env bun
/**
 * 直接初始化 D1 数据库
 * 用法：bun run infra/init-db.ts
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const DATABASE_ID = 'e871acea-dbba-4ab4-9492-4d6b91f37d53'
const TOKEN = 'd_tGJjNmSSgAb6q8xwJqf3YWiKoOWNQcyLnOz-a0'

async function initDB() {
  console.log('🚀 开始初始化 D1 数据库...')

  const migrationsDir = join(import.meta.dir, '../infra/migrations')
  const files = await readdir(migrationsDir)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  console.log(`📁 找到 ${sqlFiles.length} 个迁移文件`)

  for (const file of sqlFiles) {
    console.log(`\n📝 执行：${file}`)
    const sqlPath = join(migrationsDir, file)
    
    // 使用 wrangler d1 execute 命令执行 SQL
    const cmd = `npx wrangler d1 execute geekron-cms-db --remote --file="${sqlPath}"`
    process.env.CLOUDFLARE_API_TOKEN = TOKEN
    
    try {
      const output = execSync(cmd, { encoding: 'utf-8', env: process.env })
      console.log(output)
      console.log(`✅ 完成：${file}`)
    } catch (error: any) {
      console.error(`❌ 执行失败：${file}`)
      console.error(error.stdout || error.message)
    }
  }

  console.log('\n✅ 数据库初始化完成！')
}

initDB().catch(console.error)
