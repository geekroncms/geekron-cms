import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ApiError } from '../utils/errors';
import {
  getQuotaStatus,
  checkResourceQuota,
  updateResourceUsage,
} from '../middleware/quota-check';
import { QUOTA_PRESETS, PlanType, getQuotaPreset } from '../utils/quota-presets';

export const quotaRoutes = new Hono();

// ==================== Schema Definitions ====================

/**
 * 更新配额 Schema（仅超级管理员）
 */
const updateQuotaSchema = z.object({
  max_requests_per_minute: z.number().int().positive().optional(),
  max_requests_per_day: z.number().int().positive().optional(),
  max_storage_bytes: z.number().int().positive().optional(),
  max_users: z.number().int().positive().optional(),
  max_collections: z.number().int().positive().optional(),
  max_api_keys: z.number().int().positive().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
});

/**
 * 重置使用量 Schema（仅管理员）
 */
const resetUsageSchema = z.object({
  reset_requests: z.boolean().optional().default(true),
  reset_storage: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

// ==================== Helper Functions ====================

/**
 * 检查用户是否为超级管理员
 */
async function isSuperAdmin(c: any): Promise<boolean> {
  const role = c.get('role');
  const tenantId = c.get('tenantId');
  
  // 检查是否有系统级的超级管理员标记
  const user: any = await c.env.DB.prepare(`
    SELECT role FROM tenant_members
    WHERE user_id = ? AND tenant_id = ?
  `).bind(c.get('userId'), tenantId).first();

  return user?.role === 'owner';
}

/**
 * 检查用户是否为租户管理员
 */
async function isTenantAdmin(c: any): Promise<boolean> {
  const role = c.get('role');
  return role === 'owner' || role === 'admin';
}

// ==================== Routes ====================

/**
 * GET /quotas
 * 获取当前租户配额和使用情况
 */
quotaRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  const status = await getQuotaStatus(c, tenantId);

  return c.json({
    data: {
      tenant_id: tenantId,
      ...status,
    },
  });
});

/**
 * GET /quotas/usage
 * 获取详细使用统计
 */
quotaRoutes.get('/usage', async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  try {
    // 获取详细的使用统计
    const usage: any = await c.env.DB.prepare(`
      SELECT * FROM tenant_usage
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    const quotas: any = await c.env.DB.prepare(`
      SELECT * FROM tenant_quotas
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    if (!usage || !quotas) {
      throw new ApiError(404, 'NOT_FOUND', 'Quota or usage record not found');
    }

    // 获取资源详细统计
    const userCount: any = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM tenant_members WHERE tenant_id = ?
    `).bind(tenantId).first();

    const collectionCount: any = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM collections WHERE tenant_id = ?
    `).bind(tenantId).first();

    const apiKeyCount: any = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM api_keys WHERE tenant_id = ?
    `).bind(tenantId).first();

    const fileStorage: any = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(size), 0) as total FROM files WHERE tenant_id = ?
    `).bind(tenantId).first();

    return c.json({
      data: {
        tenant_id: tenantId,
        plan: quotas.plan,
        quotas: {
          max_requests_per_minute: quotas.max_requests_per_minute,
          max_requests_per_day: quotas.max_requests_per_day,
          max_storage_bytes: quotas.max_storage_bytes,
          max_users: quotas.max_users,
          max_collections: quotas.max_collections,
          max_api_keys: quotas.max_api_keys,
        },
        usage: {
          requests_today: usage.requests_today,
          requests_this_minute: usage.requests_this_minute,
          storage_bytes: fileStorage?.total || usage.storage_bytes,
          users_count: userCount?.count || 0,
          collections_count: collectionCount?.count || 0,
          api_keys_count: apiKeyCount?.count || 0,
        },
        usage_percent: {
          requests_today: Math.round((usage.requests_today / quotas.max_requests_per_day) * 10000) / 100,
          storage: Math.round(((fileStorage?.total || 0) / quotas.max_storage_bytes) * 10000) / 100,
          users: Math.round((userCount?.count / quotas.max_users) * 10000) / 100,
          collections: Math.round((collectionCount?.count / quotas.max_collections) * 10000) / 100,
          api_keys: Math.round((apiKeyCount?.count / quotas.max_api_keys) * 10000) / 100,
        },
        last_request_at: usage.last_request_at,
        reset_date: usage.reset_date,
        updated_at: usage.updated_at,
      },
    });
  } catch (error) {
    console.error('[Quotas] Failed to get usage details:', error);
    throw new ApiError(500, 'DATABASE_ERROR', 'Failed to fetch usage details');
  }
});

/**
 * POST /quotas/reset
 * 重置使用量（仅管理员）
 */
quotaRoutes.post('/reset', zValidator('json', resetUsageSchema), async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  // 检查权限
  if (!(await isTenantAdmin(c))) {
    throw new ApiError(403, 'FORBIDDEN', 'Only tenant admins can reset usage');
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (body.reset_requests) {
      updates.push('requests_today = 0', 'requests_this_minute = 0', 'reset_date = ?');
      params.push(today);
    }

    if (body.reset_storage) {
      // 注意：实际存储不会重置，只是重置计数器
      updates.push('storage_bytes = 0');
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'INVALID_INPUT', 'No reset options specified');
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(tenantId);

    await c.env.DB.prepare(`
      UPDATE tenant_usage
      SET ${updates.join(', ')}
      WHERE tenant_id = ?
    `).bind(...params).run();

    // 记录审计日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, user_id, action, resource, details, created_at
      ) VALUES (?, ?, ?, 'usage.reset', 'quota', ?, ?)
    `).bind(
      `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      c.get('userId'),
      JSON.stringify({ reason: body.reason, reset_requests: body.reset_requests, reset_storage: body.reset_storage }),
      now
    ).run();

    return c.json({
      success: true,
      message: 'Usage reset successfully',
      reset: {
        requests: body.reset_requests,
        storage: body.reset_storage,
      },
    });
  } catch (error) {
    console.error('[Quotas] Failed to reset usage:', error);
    throw new ApiError(500, 'DATABASE_ERROR', 'Failed to reset usage');
  }
});

/**
 * PATCH /quotas
 * 更新配额（仅超级管理员）
 */
quotaRoutes.patch('/', zValidator('json', updateQuotaSchema), async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  // 检查是否为超级管理员
  if (!(await isSuperAdmin(c))) {
    throw new ApiError(403, 'FORBIDDEN', 'Only super admins can update quotas');
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();

  try {
    // 如果指定了 plan，使用预设配额
    if (body.plan) {
      const preset = getQuotaPreset(body.plan as PlanType);
      Object.assign(body, preset);
    }

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    // 构建更新字段
    const allowedFields = [
      'max_requests_per_minute',
      'max_requests_per_day',
      'max_storage_bytes',
      'max_users',
      'max_collections',
      'max_api_keys',
      'plan',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    params.push(tenantId);

    const result = await c.env.DB.prepare(`
      UPDATE tenant_quotas
      SET ${updates.join(', ')}
      WHERE tenant_id = ?
    `).bind(...params).run();

    if (result.changes === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Quota record not found');
    }

    // 记录审计日志
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, user_id, action, resource, details, created_at
      ) VALUES (?, ?, ?, 'quota.update', 'quota', ?, ?)
    `).bind(
      `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      c.get('userId'),
      JSON.stringify({ changes: body }),
      now
    ).run();

    // 返回更新后的配额
    const updatedQuotas: any = await c.env.DB.prepare(`
      SELECT * FROM tenant_quotas WHERE tenant_id = ?
    `).bind(tenantId).first();

    return c.json({
      success: true,
      message: 'Quotas updated successfully',
      data: {
        tenant_id: tenantId,
        plan: updatedQuotas.plan,
        quotas: {
          max_requests_per_minute: updatedQuotas.max_requests_per_minute,
          max_requests_per_day: updatedQuotas.max_requests_per_day,
          max_storage_bytes: updatedQuotas.max_storage_bytes,
          max_users: updatedQuotas.max_users,
          max_collections: updatedQuotas.max_collections,
          max_api_keys: updatedQuotas.max_api_keys,
        },
      },
    });
  } catch (error) {
    console.error('[Quotas] Failed to update quotas:', error);
    throw new ApiError(500, 'DATABASE_ERROR', 'Failed to update quotas');
  }
});

/**
 * GET /quotas/check/:resource
 * 检查特定资源配额是否充足
 * 
 * 参数：resource - 资源类型（users/collections/api_keys/storage）
 * 查询参数：amount - 需要的数量（默认 1）
 */
quotaRoutes.get('/check/:resource', async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  const resource = c.req.param('resource') as 'users' | 'collections' | 'api_keys' | 'storage';
  const amount = parseInt(c.req.query('amount') || '1');

  if (!['users', 'collections', 'api_keys', 'storage'].includes(resource)) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid resource type');
  }

  const result = await checkResourceQuota(c, resource, amount);

  return c.json({
    data: {
      resource,
      requested_amount: amount,
      ...result,
      ok: result.ok,
    },
  });
});

/**
 * POST /quotas/usage/storage
 * 更新存储使用量（文件上传时调用）
 */
quotaRoutes.post('/usage/storage', async (c) => {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new ApiError(400, 'INVALID_INPUT', 'Tenant ID is required');
  }

  // 检查权限
  if (!(await isTenantAdmin(c))) {
    throw new ApiError(403, 'FORBIDDEN', 'Only tenant admins can update storage usage');
  }

  const body = await c.req.json();
  const { delta, file_id } = body;

  if (!delta || typeof delta !== 'number') {
    throw new ApiError(400, 'INVALID_INPUT', 'Delta is required and must be a number');
  }

  // 检查配额
  const quotaCheck = await checkResourceQuota(c, 'storage', Math.max(0, delta));
  
  if (!quotaCheck.ok && delta > 0) {
    return c.json({
      error: 'QUOTA_EXCEEDED',
      message: 'Storage quota exceeded',
      quota: {
        resource: 'storage',
        current: quotaCheck.current,
        limit: quotaCheck.limit,
        requested: delta,
      },
    }, 403);
  }

  // 更新使用量
  await updateResourceUsage(c, tenantId, 'storage_bytes', delta);

  return c.json({
    success: true,
    message: 'Storage usage updated',
    data: {
      delta,
      file_id,
      new_total: quotaCheck.current + delta,
      limit: quotaCheck.limit,
    },
  });
});
