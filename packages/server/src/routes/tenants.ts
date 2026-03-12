import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

export const tenantRoutes = new Hono();

// Schema 定义
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

/**
 * POST /tenants
 * 创建新租户
 */
tenantRoutes.post('/', zValidator('json', createTenantSchema), async (c) => {
  const body = c.req.valid('json');
  const tenantId = crypto.randomUUID();

  // 创建租户（D1）
  await c.env.DB.prepare(`
    INSERT INTO tenants (id, name, slug, email, plan, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
  `).bind(tenantId, body.name, body.slug, body.email, body.plan).run();

  // 同步到 Supabase PG（索引）
  // TODO: 实现 Supabase 同步逻辑

  return c.json({
    id: tenantId,
    name: body.name,
    slug: body.slug,
    message: 'Tenant created successfully',
  }, 201);
});

/**
 * GET /tenants/:id
 * 获取租户信息
 */
tenantRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const tenant = await c.env.DB.prepare(
    'SELECT * FROM tenants WHERE id = ?'
  ).bind(id).first();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  return c.json(tenant);
});

/**
 * GET /tenants
 * 获取当前租户信息（从上下文）
 */
tenantRoutes.get('/me', async (c) => {
  const tenantId = c.get('tenantId');
  
  const tenant = await c.env.DB.prepare(
    'SELECT * FROM tenants WHERE id = ?'
  ).bind(tenantId).first();

  return c.json(tenant);
});
