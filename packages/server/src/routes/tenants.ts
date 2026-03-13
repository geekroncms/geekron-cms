import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { ApiError, ErrorCodes, errors } from '../utils/errors'

export const tenantRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>

// ==================== Schema Definitions ====================

const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(50, 'Subdomain too long')
    .regex(
      /^[a-z][a-z0-9-]*[a-z0-9]$/,
      'Subdomain must start and end with lowercase letter, and contain only lowercase letters, numbers, and hyphens',
    ),
  email: z.string().email('Invalid email format'),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  settings: z.record(z.any()).optional(),
})

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  settings: z.record(z.any()).optional(),
})

const tenantIdSchema = z.object({
  id: z.string().uuid('Invalid tenant ID format'),
})

// ==================== Helper Functions ====================

/**
 * 验证子域名是否可用
 */
async function isSubdomainAvailable(db: D1Database, subdomain: string): Promise<boolean> {
  const existing: any = await db
    .prepare('SELECT id FROM tenants WHERE subdomain = ?')
    .bind(subdomain)
    .first()

  return !existing
}

/**
 * 获取租户配额配置
 */
function getPlanQuotas(plan: string) {
  const quotas: Record<string, { apiCalls: number; storageMb: number; users: number }> = {
    free: { apiCalls: 1000, storageMb: 100, users: 5 },
    pro: { apiCalls: 10000, storageMb: 1000, users: 25 },
    enterprise: { apiCalls: 100000, storageMb: 10000, users: 100 },
  }

  return quotas[plan] || quotas.free
}

/**
 * 检查租户状态
 */
function checkTenantStatus(tenant: any) {
  if (!tenant) {
    throw errors.notFound('Tenant')
  }

  if (tenant.status === 'deleted') {
    throw new ApiError(410, ErrorCodes.GONE, 'Tenant has been deleted')
  }

  if (tenant.status === 'suspended') {
    throw errors.forbidden('Tenant is suspended')
  }
}

// ==================== CRUD Routes ====================

/**
 * POST /tenants
 * 创建新租户
 */
tenantRoutes.post('/', zValidator('json', createTenantSchema), async (c) => {
  const body = c.req.valid('json')

  // 检查子域名唯一性
  const available = await isSubdomainAvailable(c.env.DB, body.subdomain)
  if (!available) {
    throw errors.conflict('Subdomain already taken')
  }

  const tenantId = crypto.randomUUID()
  const quotas = getPlanQuotas(body.plan || 'free')

  await c.env.DB.prepare(
    `
    INSERT INTO tenants (
      id, name, subdomain, email, plan, status, settings,
      quota_api_calls, quota_storage_mb, quota_users,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'), datetime('now'))
  `,
  )
    .bind(
      tenantId,
      body.name,
      body.subdomain,
      body.email,
      body.plan || 'free',
      JSON.stringify(body.settings || {}),
      quotas.apiCalls,
      quotas.storageMb,
      quotas.users,
    )
    .run()

  return c.json(
    {
      id: tenantId,
      name: body.name,
      subdomain: body.subdomain,
      email: body.email,
      plan: body.plan || 'free',
      status: 'active',
      quotas,
      message: 'Tenant created successfully',
    },
    201,
  )
})

/**
 * GET /tenants
 * 列出租户（分页）
 */
tenantRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit

  const status = c.req.query('status')
  const plan = c.req.query('plan')

  // 构建查询条件
  let whereClause = '1=1'
  const params: any[] = []

  if (status) {
    whereClause += ' AND status = ?'
    params.push(status)
  }

  if (plan) {
    whereClause += ' AND plan = ?'
    params.push(plan)
  }

  params.push(limit, offset)

  const tenants: any = await c.env.DB.prepare(
    `
    SELECT 
      id, name, subdomain, email, plan, status, settings,
      quota_api_calls, quota_storage_mb, quota_users,
      usage_api_calls, usage_storage_mb, usage_users,
      created_at, updated_at
    FROM tenants
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,
  )
    .bind(...params)
    .all()

  const total: any = await c.env.DB.prepare(
    `
    SELECT COUNT(*) as count FROM tenants WHERE ${whereClause}
  `,
  )
    .bind(...params.slice(0, params.length - 2))
    .first()

  return c.json({
    data: (tenants.results || []).map((t: any) => ({
      ...t,
      settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings,
      quotas: {
        apiCalls: t.quota_api_calls,
        storageMb: t.quota_storage_mb,
        users: t.quota_users,
      },
      usage: {
        apiCalls: t.usage_api_calls,
        storageMb: t.usage_storage_mb,
        users: t.usage_users,
      },
    })),
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
    },
  })
})

/**
 * GET /tenants/:id
 * 获取租户详情
 */
tenantRoutes.get('/:id', async (c) => {
  const { id } = c.req.param()

  const tenant: any = await c.env.DB.prepare(
    `
    SELECT 
      id, name, subdomain, email, plan, status, settings,
      quota_api_calls, quota_storage_mb, quota_users,
      usage_api_calls, usage_storage_mb, usage_users,
      created_at, updated_at
    FROM tenants WHERE id = ?
  `,
  )
    .bind(id)
    .first()

  if (!tenant) {
    throw errors.notFound('Tenant')
  }

  // 获取成员数量
  const memberCount: any = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM tenant_members WHERE tenant_id = ?',
  )
    .bind(id)
    .first()

  return c.json({
    ...tenant,
    settings: typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings,
    memberCount: memberCount?.count || 0,
    quotas: {
      apiCalls: tenant.quota_api_calls,
      storageMb: tenant.quota_storage_mb,
      users: tenant.quota_users,
    },
    usage: {
      apiCalls: tenant.usage_api_calls,
      storageMb: tenant.usage_storage_mb,
      users: tenant.usage_users,
    },
  })
})

/**
 * PATCH /tenants/:id
 * 更新租户
 */
tenantRoutes.patch('/:id', zValidator('json', updateTenantSchema), async (c) => {
  const { id } = c.req.param()
  const body = c.req.valid('json')

  // 检查租户是否存在
  const existing: any = await c.env.DB.prepare('SELECT id, plan FROM tenants WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    throw errors.notFound('Tenant')
  }

  // 构建更新字段
  const updates: string[] = []
  const values: any[] = []

  if (body.name) {
    updates.push('name = ?')
    values.push(body.name)
  }

  if (body.email) {
    updates.push('email = ?')
    values.push(body.email)
  }

  if (body.plan) {
    updates.push('plan = ?')
    const quotas = getPlanQuotas(body.plan)
    updates.push('quota_api_calls = ?')
    values.push(quotas.apiCalls)
    updates.push('quota_storage_mb = ?')
    values.push(quotas.storageMb)
    updates.push('quota_users = ?')
    values.push(quotas.users)
    values.push(body.plan)
  }

  if (body.settings !== undefined) {
    updates.push('settings = ?')
    values.push(JSON.stringify(body.settings))
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  const query = `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`
  await c.env.DB.prepare(query)
    .bind(...values)
    .run()

  return c.json({
    message: 'Tenant updated successfully',
    id,
  })
})

/**
 * DELETE /tenants/:id
 * 删除租户（软删除）
 */
tenantRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param()

  // 检查租户是否存在
  const existing: any = await c.env.DB.prepare('SELECT id, status FROM tenants WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    throw errors.notFound('Tenant')
  }

  if (existing.status === 'deleted') {
    throw errors.conflict('Tenant already deleted')
  }

  // 软删除：将状态设置为 deleted
  await c.env.DB.prepare(
    `
    UPDATE tenants 
    SET status = 'deleted', updated_at = datetime('now')
    WHERE id = ?
  `,
  )
    .bind(id)
    .run()

  return c.json({
    message: 'Tenant deleted successfully',
    id,
  })
})

// ==================== Status Management Routes ====================

/**
 * POST /tenants/:id/activate
 * 激活租户
 */
tenantRoutes.post('/:id/activate', async (c) => {
  const { id } = c.req.param()

  // 检查租户是否存在
  const existing: any = await c.env.DB.prepare('SELECT id, status FROM tenants WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    throw errors.notFound('Tenant')
  }

  if (existing.status === 'active') {
    return c.json({
      message: 'Tenant is already active',
      id,
    })
  }

  if (existing.status === 'deleted') {
    throw errors.conflict('Cannot activate a deleted tenant')
  }

  await c.env.DB.prepare(
    `
    UPDATE tenants 
    SET status = 'active', updated_at = datetime('now')
    WHERE id = ?
  `,
  )
    .bind(id)
    .run()

  return c.json({
    message: 'Tenant activated successfully',
    id,
  })
})

/**
 * POST /tenants/:id/suspend
 * 暂停租户
 */
tenantRoutes.post('/:id/suspend', async (c) => {
  const { id } = c.req.param()

  // 检查租户是否存在
  const existing: any = await c.env.DB.prepare('SELECT id, status FROM tenants WHERE id = ?')
    .bind(id)
    .first()

  if (!existing) {
    throw errors.notFound('Tenant')
  }

  if (existing.status === 'suspended') {
    return c.json({
      message: 'Tenant is already suspended',
      id,
    })
  }

  if (existing.status === 'deleted') {
    throw errors.conflict('Cannot suspend a deleted tenant')
  }

  await c.env.DB.prepare(
    `
    UPDATE tenants 
    SET status = 'suspended', updated_at = datetime('now')
    WHERE id = ?
  `,
  )
    .bind(id)
    .run()

  return c.json({
    message: 'Tenant suspended successfully',
    id,
  })
})

// ==================== Subdomain Validation ====================

/**
 * GET /tenants/check-subdomain/:subdomain
 * 检查子域名是否可用
 */
tenantRoutes.get('/check-subdomain/:subdomain', async (c) => {
  const { subdomain } = c.req.param()

  // 验证子域名格式
  const isValid = /^[a-z][a-z0-9-]*[a-z0-9]$/.test(subdomain)
  if (!isValid) {
    return c.json({
      available: false,
      valid: false,
      message: 'Invalid subdomain format',
    })
  }

  const available = await isSubdomainAvailable(c.env.DB, subdomain)

  return c.json({
    available,
    valid: true,
    subdomain,
  })
})

// ==================== Quota Management ====================

/**
 * GET /tenants/:id/quotas
 * 获取租户配额使用情况
 */
tenantRoutes.get('/:id/quotas', async (c) => {
  const { id } = c.req.param()

  const tenant: any = await c.env.DB.prepare(
    `
    SELECT 
      plan,
      quota_api_calls, quota_storage_mb, quota_users,
      usage_api_calls, usage_storage_mb, usage_users
    FROM tenants WHERE id = ?
  `,
  )
    .bind(id)
    .first()

  if (!tenant) {
    throw errors.notFound('Tenant')
  }

  return c.json({
    plan: tenant.plan,
    quotas: {
      apiCalls: {
        limit: tenant.quota_api_calls,
        used: tenant.usage_api_calls,
        remaining: tenant.quota_api_calls - tenant.usage_api_calls,
        percentage: Math.round((tenant.usage_api_calls / tenant.quota_api_calls) * 100),
      },
      storage: {
        limit: tenant.quota_storage_mb,
        used: tenant.usage_storage_mb,
        remaining: tenant.quota_storage_mb - tenant.usage_storage_mb,
        percentage: Math.round((tenant.usage_storage_mb / tenant.quota_storage_mb) * 100),
      },
      users: {
        limit: tenant.quota_users,
        used: tenant.usage_users,
        remaining: tenant.quota_users - tenant.usage_users,
        percentage: Math.round((tenant.usage_users / tenant.quota_users) * 100),
      },
    },
  })
})

/**
 * POST /tenants/:id/quotas/reset
 * 重置租户配额使用量（管理员操作）
 */
tenantRoutes.post('/:id/quotas/reset', async (c) => {
  const { id } = c.req.param()

  const tenant: any = await c.env.DB.prepare('SELECT id FROM tenants WHERE id = ?').bind(id).first()

  if (!tenant) {
    throw errors.notFound('Tenant')
  }

  await c.env.DB.prepare(
    `
    UPDATE tenants 
    SET usage_api_calls = 0, usage_storage_mb = 0, usage_users = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  )
    .bind(id)
    .run()

  return c.json({
    message: 'Quotas reset successfully',
    id,
  })
})
