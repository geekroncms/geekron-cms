import { Context, Next } from 'hono'
import { jwtVerify } from 'jose'

/**
 * JWT 认证中间件
 * 验证 Authorization Header 中的 JWT Token
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 允许公开访问的路由
    const publicPaths = ['/auth/login', '/auth/register']
    if (publicPaths.includes(c.req.path)) {
      return await next()
    }

    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.substring(7) // 移除 "Bearer "
  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key'

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(jwtSecret))

    // 提取用户信息
    const payload = verified.payload as any
    c.set('userId', payload.sub)
    c.set('role', payload.role || 'user')

    await next()
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
