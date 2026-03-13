#!/usr/bin/env bun
/**
 * 数据库迁移脚本
 * 用法：bun run db:migrate
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

interface Env {
  DB: D1Database
}

async function migrate() {
  console.log('🔄 开始执行数据库迁移...')

  // 获取 D1 数据库实例
  const db = (globalThis as any).__DB__

  if (!db) {
    console.error('❌ 错误：未找到 D1 数据库连接')
    console.log('请确保在 Wrangler 环境中运行，或设置 __DB__ 全局变量')
    return
  }

  // 读取迁移文件
  const migrationsDir = join(import.meta.dir, '../../infra/migrations')
  const files = await readdir(migrationsDir)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  console.log(`📁 找到 ${sqlFiles.length} 个迁移文件`)

  // 创建迁移记录表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 获取已执行的迁移
  const executed = await db.prepare('SELECT name FROM _migrations').all()
  const executedNames = new Set(executed.results?.map((r: any) => r.name) || [])

  // 执行未执行的迁移
  for (const file of sqlFiles) {
    if (executedNames.has(file)) {
      console.log(`⏭️  跳过：${file}`)
      continue
    }

    console.log(`📝 执行：${file}`)

    const sql = await readFile(join(migrationsDir, file), 'utf-8')

    // 执行迁移
    await db.exec(sql)

    // 记录迁移
    await db.prepare('INSERT INTO _migrations (name) VALUES (?)').bind(file).run()

    console.log(`✅ 完成：${file}`)
  }

  console.log('✅ 所有迁移执行完成！')
}

// 运行迁移
migrate().catch(console.error)
