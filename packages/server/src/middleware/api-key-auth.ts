import { Context, Next } from 'hono'
import { jwtVerify } from 'jose'

/**
 * API Key 认证中间件
 * 支持两种认证方式：
 * 1. API Key 认证（Header: X-API-Key: gk_xxx）
 * 2. JWT 认证（Header: Authorization: Bearer xxx）
 *
 * 验证 Key 是否存在且未过期
 * 提取 tenant_id 和 permissions 到上下文
 */
export async function apiKeyAuthMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key')
  const authHeader = c.req.header('Authorization')

  // 允许公开访问的路由
  const publicPaths = ['/auth/login', '/auth/register', '/health']
  if (publicPaths.includes(c.req.path)) {
    return await next()
  }

  // 优先尝试 API Key 认证
  if (apiKey) {
    return await authenticateWithApiKey(c, next, apiKey)
  }

  // 回退到 JWT 认证
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return await authenticateWithJwt(c, next, authHeader)
  }

  return c.json(
    {
      error: 'AUTHENTICATION_REQUIRED',
      message: 'X-API-Key or Authorization header required',
    },
    401,
  )
}

/**
 * 使用 API Key 进行认证
 */
async function authenticateWithApiKey(c: Context, next: Next, apiKey: string) {
  try {
    // Hash API Key 用于查询
    const hashedKey = await hashApiKey(apiKey)

    // 查询 API Key 记录
    const keyRecord: any = await c.env.DB.prepare(
      `
      SELECT id, tenant_id, name, permissions, expires_at, last_used_at 
      FROM api_keys 
      WHERE key = ?
    `,
    )
      .bind(hashedKey)
      .first()

    if (!keyRecord) {
      return c.json(
        {
          error: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
        401,
      )
    }

    // 检查是否过期
    if (keyRecord.expires_at) {
      const expiresAt = new Date(keyRecord.expires_at)
      if (expiresAt < new Date()) {
        return c.json(
          {
            error: 'API_KEY_EXPIRED',
            message: 'API key has expired',
          },
          401,
        )
      }
    }

    // 验证租户状态
    const tenant: any = await c.env.DB.prepare(
      `
      SELECT id, status, plan FROM tenants WHERE id = ?
    `,
    )
      .bind(keyRecord.tenant_id)
      .first()

    if (!tenant) {
      return c.json(
        {
          error: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        },
        404,
      )
    }

    if (tenant.status !== 'active') {
      return c.json(
        {
          error: 'TENANT_NOT_ACTIVE',
          message: 'Tenant is not active',
        },
        403,
      )
    }

    // 更新 last_used_at
    const now = new Date().toISOString()
    await c.env.DB.prepare(
      `
      UPDATE api_keys SET last_used_at = ? WHERE id = ?
    `,
    )
      .bind(now, keyRecord.id)
      .run()

    // 解析权限
    const permissions =
      typeof keyRecord.permissions === 'string'
        ? JSON.parse(keyRecord.permissions)
        : keyRecord.permissions || ['read']

    // 注入上下文
    c.set('tenantId', keyRecord.tenant_id)
    c.set('userId', keyRecord.id) // API Key ID 作为 userId
    c.set('role', 'api_key')
    c.set('permissions', permissions)
    c.set('authMethod', 'api_key')

    await next()
  } catch (error) {
    console.error('[APIKeyAuth] Authentication error:', error)
    return c.json(
      {
        error: 'AUTHENTICATION_ERROR',
        message: 'Failed to authenticate API key',
      },
      500,
    )
  }
}

/**
 * 使用 JWT 进行认证
 */
async function authenticateWithJwt(c: Context, next: Next, authHeader: string) {
  const token = authHeader.substring(7) // 移除 "Bearer "
  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key'

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(jwtSecret))

    // 提取用户信息
    const payload = verified.payload as any
    c.set('userId', payload.sub)
    c.set('role', payload.role || 'user')
    c.set('email', payload.email)
    c.set('permissions', payload.permissions || [])
    c.set('authMethod', 'jwt')

    // 如果是 JWT，tenantId 应该由 tenantMiddleware 设置
    await next()
  } catch (error) {
    console.error('[APIKeyAuth] JWT verification error:', error)
    return c.json(
      {
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
      401,
    )
  }
}

/**
 * Hash API Key for storage and lookup
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 检查权限是否满足要求
 * @param required - 需要的权限
 * @param available - 可用的权限
 * @param mode - 'AND' 或 'OR'
 */
export function hasPermission(
  required: string | string[],
  available: string[],
  mode: 'AND' | 'OR' = 'OR',
): boolean {
  const requiredList = Array.isArray(required) ? required : [required]

  if (mode === 'OR') {
    return requiredList.some((perm) => available.includes(perm))
  } else {
    return requiredList.every((perm) => available.includes(perm))
  }
}
