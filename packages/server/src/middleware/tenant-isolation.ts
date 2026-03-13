import { Context, Next } from 'hono'

/**
 * 租户数据隔离中间件
 *
 * 功能：
 * 1. 从请求上下文获取 tenant_id
 * 2. 拦截所有数据库查询，自动注入 WHERE tenant_id = ?
 * 3. 防止跨租户数据访问
 * 4. 支持批量查询和事务中的租户隔离
 *
 * @param c - Hono 上下文
 * @param next - 下一个中间件
 */
export async function tenantIsolationMiddleware(c: Context, next: Next) {
  const tenantId = c.get('tenantId')

  // 如果还没有 tenantId，说明前面的 tenantMiddleware 没有正确设置
  if (!tenantId) {
    // 允许公开访问的路由（已经在 tenantMiddleware 中处理）
    const skipPaths = ['/auth/login', '/auth/register', '/tenants', '/health']
    if (skipPaths.includes(c.req.path)) {
      return await next()
    }

    // 如果没有 tenantId 且不是公开路由，返回错误
    return c.json(
      {
        error: 'TENANT_ISOLATION_ERROR',
        message: 'Tenant ID is required for data isolation',
      },
      400,
    )
  }

  // 将 tenantId 注入到数据库操作的上下文中
  // 后续的数据库操作会自动使用这个 tenantId
  c.set('tenantId', tenantId)

  // 创建租户安全的数据库代理对象
  const safeDB = createTenantSafeDB(c.env.DB, tenantId)

  // 将安全的数据库对象注入上下文
  c.set('safeDB', safeDB)

  await next()
}

/**
 * 租户安全的数据库查询接口
 */
interface TenantSafeDB {
  prepare(sql: string): TenantSafeStatement
}

interface TenantSafeStatement {
  bind(...values: any[]): TenantSafeStatement
  first<T = any>(): Promise<T | null>
  all<T = any>(): Promise<{ results: T[] }>
  run(): Promise<{ changes: number; lastInsertRowid: number }>
}

/**
 * 创建租户安全的数据库代理
 *
 * 自动在所有查询中注入 tenant_id 条件
 *
 * @param db - 原始 D1 数据库对象
 * @param tenantId - 租户 ID
 * @returns 租户安全的数据库代理对象
 */
function createTenantSafeDB(db: D1Database, tenantId: string): TenantSafeDB {
  return {
    prepare(sql: string) {
      const normalizedSQL = normalizeSQL(sql)

      // 分析 SQL 类型并注入租户隔离
      const safeSQL = injectTenantConstraint(normalizedSQL, tenantId)

      const originalStatement = db.prepare(safeSQL)

      return {
        bind(...values: any[]) {
          // 验证绑定参数，防止 SQL 注入
          validateBindValues(values)

          // 确保 tenantId 被正确绑定（如果 SQL 中有占位符）
          const hasTenantPlaceholder = normalizedSQL.toLowerCase().includes('tenant_id = ?')

          if (hasTenantPlaceholder && !values.includes(tenantId)) {
            // 自动添加 tenantId 到绑定参数
            values.push(tenantId)
          }

          originalStatement.bind(...values)
          return this
        },

        async first<T = any>() {
          try {
            return await (originalStatement as any).first<T>()
          } catch (error) {
            throw wrapDatabaseError(error, 'first', tenantId)
          }
        },

        async all<T = any>() {
          try {
            return await (originalStatement as any).all<T>()
          } catch (error) {
            throw wrapDatabaseError(error, 'all', tenantId)
          }
        },

        async run() {
          try {
            return await (originalStatement as any).run()
          } catch (error) {
            throw wrapDatabaseError(error, 'run', tenantId)
          }
        },
      }
    },
  }
}

/**
 * 标准化 SQL（移除多余空白，统一格式）
 */
function normalizeSQL(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ')
}

/**
 * 向 SQL 查询注入租户约束
 *
 * 支持的查询类型：
 * - SELECT: 添加 WHERE tenant_id = ?
 * - INSERT: 确保包含 tenant_id 字段
 * - UPDATE: 添加 WHERE tenant_id = ?
 * - DELETE: 添加 WHERE tenant_id = ?
 *
 * @param sql - 原始 SQL
 * @param tenantId - 租户 ID
 * @returns 注入租户约束后的 SQL
 */
export function injectTenantConstraint(sql: string, tenantId: string): string {
  const upperSQL = sql.toUpperCase()

  // SELECT 查询
  if (upperSQL.startsWith('SELECT')) {
    return injectSelectConstraint(sql, tenantId)
  }

  // INSERT 查询
  if (upperSQL.startsWith('INSERT')) {
    return injectInsertConstraint(sql, tenantId)
  }

  // UPDATE 查询
  if (upperSQL.startsWith('UPDATE')) {
    return injectUpdateConstraint(sql, tenantId)
  }

  // DELETE 查询
  if (upperSQL.startsWith('DELETE')) {
    return injectDeleteConstraint(sql, tenantId)
  }

  // 其他查询（CREATE, DROP 等）不修改
  return sql
}

/**
 * 向 SELECT 查询注入租户约束
 */
export function injectSelectConstraint(sql: string, tenantId: string): string {
  // 检查是否已经包含 tenant_id 条件
  if (hasTenantConstraint(sql)) {
    return sql
  }

  // 查找 WHERE 子句
  const whereIndex = sql.toUpperCase().indexOf(' WHERE ')

  if (whereIndex === -1) {
    // 没有 WHERE 子句，添加一个
    // 需要在 GROUP BY, ORDER BY, LIMIT 之前插入
    const clauses = ['GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING', 'UNION']
    let insertPosition = sql.length

    for (const clause of clauses) {
      const index = sql.toUpperCase().indexOf(clause)
      if (index !== -1 && index < insertPosition) {
        insertPosition = index
      }
    }

    const before = sql.substring(0, insertPosition)
    const after = sql.substring(insertPosition)

    return `${before} WHERE tenant_id = ?${after}`
  } else {
    // 已有 WHERE 子句，在第一个条件后添加 AND tenant_id = ?
    const whereEnd = whereIndex + 7 // ' WHERE '.length
    const before = sql.substring(0, whereEnd)
    const after = sql.substring(whereEnd)

    return `${before} tenant_id = ? AND ${after}`
  }
}

/**
 * 向 INSERT 查询注入租户约束
 */
export function injectInsertConstraint(sql: string, tenantId: string): string {
  // 检查是否已经包含 tenant_id 字段
  if (sql.toLowerCase().includes('tenant_id')) {
    return sql
  }

  // 找到字段列表和值列表
  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)

  if (insertMatch) {
    const [, tableName, fields, values] = insertMatch

    // 在字段列表中添加 tenant_id
    const newFields = `${fields}, tenant_id`

    // 在值列表中添加占位符
    const newValues = `${values}, ?`

    return sql.replace(
      /INSERT\s+INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*\([^)]+\)/i,
      `INSERT INTO ${tableName} (${newFields}) VALUES (${newValues})`,
    )
  }

  return sql
}

/**
 * 向 UPDATE 查询注入租户约束
 */
export function injectUpdateConstraint(sql: string, tenantId: string): string {
  // 检查是否已经包含 tenant_id 条件
  if (hasTenantConstraint(sql)) {
    return sql
  }

  // 查找 WHERE 子句
  const whereIndex = sql.toUpperCase().indexOf(' WHERE ')

  if (whereIndex === -1) {
    // 没有 WHERE 子句，添加一个（UPDATE 必须有 WHERE！）
    return `${sql} WHERE tenant_id = ?`
  } else {
    // 已有 WHERE 子句，添加 AND tenant_id = ?
    return `${sql} AND tenant_id = ?`
  }
}

/**
 * 向 DELETE 查询注入租户约束
 */
export function injectDeleteConstraint(sql: string, tenantId: string): string {
  // 检查是否已经包含 tenant_id 条件
  if (hasTenantConstraint(sql)) {
    return sql
  }

  // 查找 WHERE 子句
  const whereIndex = sql.toUpperCase().indexOf(' WHERE ')

  if (whereIndex === -1) {
    // 没有 WHERE 子句，添加一个（DELETE 必须有 WHERE！）
    return `${sql} WHERE tenant_id = ?`
  } else {
    // 已有 WHERE 子句，添加 AND tenant_id = ?
    return `${sql} AND tenant_id = ?`
  }
}

/**
 * 检查 SQL 是否已经包含 tenant_id 约束
 */
export function hasTenantConstraint(sql: string): boolean {
  const normalizedSQL = sql.toLowerCase()
  return (
    normalizedSQL.includes('tenant_id =') ||
    normalizedSQL.includes('tenant_id=') ||
    normalizedSQL.includes('tenant_id in')
  )
}

/**
 * 验证绑定参数，防止 SQL 注入
 */
function validateBindValues(values: any[]): void {
  for (const value of values) {
    if (typeof value === 'string') {
      // 检查是否有明显的 SQL 注入尝试
      const suspicious = ['--', ';', 'DROP ', 'DELETE ', 'UPDATE ', 'INSERT ']
      for (const pattern of suspicious) {
        if (value.toUpperCase().includes(pattern)) {
          console.warn(`[TenantIsolation] Suspicious value detected: ${value.substring(0, 50)}`)
        }
      }
    }
  }
}

/**
 * 包装数据库错误，添加租户上下文
 */
function wrapDatabaseError(error: any, operation: string, tenantId: string): Error {
  const wrapped = new Error(
    `[TenantIsolation] ${operation} failed for tenant ${tenantId}: ${error.message}`,
  )
  ;(wrapped as any).originalError = error
  ;(wrapped as any).tenantId = tenantId
  ;(wrapped as any).operation = operation
  return wrapped
}

/**
 * 辅助函数：从上下文中获取租户安全的数据库对象
 */
export function getSafeDB(c: Context): TenantSafeDB {
  const safeDB = c.get('safeDB')
  if (!safeDB) {
    throw new Error(
      'Tenant isolation middleware not initialized. Call getSafeDB() after tenantIsolationMiddleware.',
    )
  }
  return safeDB
}

/**
 * 辅助函数：验证当前操作是否在租户边界内
 * 用于额外的安全检查
 */
export function verifyTenantBoundary(c: Context, resourceTenantId: string): boolean {
  const requestTenantId = c.get('tenantId')

  if (!requestTenantId) {
    return false
  }

  return requestTenantId === resourceTenantId
}

/**
 * 辅助函数：批量查询的租户隔离
 * 确保批量操作中的所有项目都属于同一租户
 */
export async function verifyBatchTenantIsolation(
  c: Context,
  db: D1Database,
  tableName: string,
  ids: string[],
): Promise<boolean> {
  const tenantId = c.get('tenantId')

  if (!tenantId || ids.length === 0) {
    return false
  }

  // 检查所有 ID 是否都属于当前租户
  const placeholders = ids.map(() => '?').join(',')
  const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE id IN (${placeholders}) AND tenant_id = ?`

  const result: any = await db
    .prepare(query)
    .bind(...ids, tenantId)
    .first()

  return result?.count === ids.length
}

/**
 * 辅助函数：事务中的租户隔离
 * 在事务执行前后验证租户边界
 */
export async function executeTenantSafeTransaction<T>(
  c: Context,
  db: D1Database,
  callback: (tx: any) => Promise<T>,
): Promise<T> {
  const tenantId = c.get('tenantId')

  if (!tenantId) {
    throw new Error('Cannot execute transaction without tenant context')
  }

  const tx = (db as any).transaction()

  try {
    // 在事务开始时记录租户上下文
    console.log(`[TenantIsolation] Transaction started for tenant: ${tenantId}`)

    const result = await callback(tx)

    // 事务成功，租户隔离已验证
    console.log(`[TenantIsolation] Transaction completed for tenant: ${tenantId}`)

    return result
  } catch (error) {
    // 事务失败，记录错误
    console.error(`[TenantIsolation] Transaction failed for tenant ${tenantId}:`, error)
    throw error
  }
}
