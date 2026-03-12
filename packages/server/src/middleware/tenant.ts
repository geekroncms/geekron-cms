import { Context, Next } from 'hono';

/**
 * 多租户中间件
 * 从 Header 或 JWT 中提取租户 ID 并注入上下文
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const tenantId = c.req.header('X-Tenant-ID');
  
  if (!tenantId) {
    // 某些路由可能不需要租户上下文（如超级管理员）
    const skipPaths = ['/auth/login', '/auth/register', '/tenants'];
    if (skipPaths.includes(c.req.path)) {
      return await next();
    }
    
    return c.json({ error: 'X-Tenant-ID header is required' }, 400);
  }

  // 验证租户是否存在（从 D1 或缓存）
  const tenant = await c.env.DB.prepare(
    'SELECT id, status, plan FROM tenants WHERE id = ?'
  )
    .bind(tenantId)
    .first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  if (tenant.status !== 'active') {
    return c.json({ error: 'Tenant is not active' }, 403);
  }

  // 注入租户上下文
  c.set('tenantId', tenantId);

  await next();
}
