/**
 * PostgreSQL 数据库迁移脚本
 * 用于初始化 Supabase PostgreSQL 数据库表结构
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'

interface MigrationConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export class PostgresMigrator {
  private pool: Pool

  constructor(config: MigrationConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    })
  }

  /**
   * 创建迁移历史表
   */
  private async createMigrationTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    console.log('✓ Migration table created')
  }

  /**
   * 检查迁移是否已执行
   */
  private async isMigrationExecuted(name: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM _migrations WHERE name = $1', [name])
    return result.rowCount !== null && result.rowCount > 0
  }

  /**
   * 记录迁移执行
   */
  private async recordMigration(name: string): Promise<void> {
    await this.pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name])
  }

  /**
   * 执行 SQL 文件
   */
  private async executeSqlFile(filePath: string): Promise<void> {
    const sql = readFileSync(filePath, 'utf-8')

    // 分割 SQL 语句（按分号分隔，但忽略注释中的分号）
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        await this.pool.query(statement)
      }
    }
  }

  /**
   * 运行所有迁移
   */
  async run(): Promise<void> {
    console.log('Starting PostgreSQL migrations...\n')

    await this.createMigrationTable()

    const migrationsDir = join(__dirname, '../../infra/migrations')
    const migrationFiles = ['001_initial_schema.sql']

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file)

      if (await this.isMigrationExecuted(file)) {
        console.log(`⊘ Skipping ${file} (already executed)`)
        continue
      }

      try {
        console.log(`Executing ${file}...`)
        await this.executeSqlFile(filePath)
        await this.recordMigration(file)
        console.log(`✓ ${file} completed\n`)
      } catch (error) {
        console.error(`✗ ${file} failed:`, error)
        throw error
      }
    }

    console.log('All migrations completed successfully!')
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}

// CLI 入口
async function main() {
  const config: MigrationConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'geekron_cms',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  }

  console.log('Connecting to PostgreSQL...')
  console.log(`Host: ${config.host}:${config.port}`)
  console.log(`Database: ${config.database}\n`)

  const migrator = new PostgresMigrator(config)

  try {
    await migrator.run()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await migrator.close()
  }
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  main()
}
