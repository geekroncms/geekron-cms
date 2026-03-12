import { Context, Next } from 'hono';
import { QUOTA_PRESETS, PlanType, calculateUsagePercent, isApproachingLimit } from '../utils/quota-presets';

/**
 * 配额检查中间件
 * 
 * 功能：
 * 1. 检查租户资源使用量（存储、用户数、集合数等）
 * 2. 创建资源前检查配额是否充足
 * 3. 超配额返回 403 Forbidden + 错误信息
 * 4. 支持配额警告（使用量>80% 时返回 Warning Header）
 * 
 * @param c - Hono 上下文
 * @param next - 下一个中间件
 */
export async function quotaCheckMiddleware(c: Context, next: Next) {
  // 跳过配额检查的路由
  const skipPaths = ['/health', '/health/ready', '/quotas', '/quotas/usage'];
  if (skipPaths.some(path => c.req.path.startsWith(path))) {
    return await next();
  }

  // 获取租户 ID
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    // 没有租户 ID，跳过配额检查
    return await next();
  }

  // 获取租户配额和使用量
  const { quotas, usage } = await getTenantQuotaUsage(c, tenantId);

  // 检查各项配额
  const quotaChecks = [
    {
      name: 'users',
      current: usage.users_count,
      limit: quotas.max_users,
      resourceType: 'user',
    },
    {
      name: 'collections',
      current: usage.collections_count,
      limit: quotas.max_collections,
      resourceType: 'collection',
    },
    {
      name: 'api_keys',
      current: usage.api_keys_count,
      limit: quotas.max_api_keys,
      resourceType: 'api_key',
    },
    {
      name: 'storage',
      current: usage.storage_bytes,
      limit: quotas.max_storage_bytes,
      resourceType: 'storage',
    },
  ];

  // 检查是否有超配额的项目
  for (const check of quotaChecks) {
    if (check.current >= check.limit) {
      // 根据请求方法判断是否是创建操作
      if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: `Quota exceeded for ${check.name}. Current: ${check.current}, Limit: ${check.limit}`,
            quota: {
              resource: check.name,
              current: check.current,
              limit: check.limit,
              usage_percent: 100,
            },
            suggestion: 'Please upgrade your plan or delete unused resources.',
          },
          403
        );
      }
    }
  }

  // 检查是否需要返回配额警告（使用量 > 80%）
  const warnings: string[] = [];
  for (const check of quotaChecks) {
    if (isApproachingLimit(check.current, check.limit, 80)) {
      const percent = calculateUsagePercent(check.current, check.limit);
      warnings.push(`${check.name}: ${percent}% used`);
    }
  }

  // 如果有警告，添加 Warning Header
  if (warnings.length > 0) {
    c.header('X-Quota-Warning', warnings.join('; '));
    c.header('X-Quota-Usage-Percent', calculateOverallUsagePercent(quotas, usage).toString());
  }

  // 将配额信息注入上下文，供后续使用
  c.set('quotaStatus', {
    quotas,
    usage,
    warnings,
  });

  await next();
}

/**
 * 获取租户配额和使用量
 */
async function getTenantQuotaUsage(c: Context, tenantId: string): Promise<{
  quotas: TenantQuotas;
  usage: TenantUsage;
}> {
  try {
    // 从数据库查询配额和使用量
    const result: any = await c.env.DB.prepare(`
      SELECT 
        tq.max_requests_per_minute,
        tq.max_requests_per_day,
        tq.max_storage_bytes,
        tq.max_users,
        tq.max_collections,
        tq.max_api_keys,
        tq.plan,
        tu.requests_today,
        tu.requests_this_minute,
        tu.storage_bytes,
        tu.users_count,
        tu.collections_count,
        tu.api_keys_count
      FROM tenant_quotas tq
      INNER JOIN tenant_usage tu ON tq.tenant_id = tu.tenant_id
      WHERE tq.tenant_id = ?
    `).bind(tenantId).first();

    if (result) {
      return {
        quotas: {
          max_requests_per_minute: result.max_requests_per_minute,
          max_requests_per_day: result.max_requests_per_day,
          max_storage_bytes: result.max_storage_bytes,
          max_users: result.max_users,
          max_collections: result.max_collections,
          max_api_keys: result.max_api_keys,
          plan: result.plan as PlanType,
        },
        usage: {
          requests_today: result.requests_today || 0,
          requests_this_minute: result.requests_this_minute || 0,
          storage_bytes: result.storage_bytes || 0,
          users_count: result.users_count || 0,
          collections_count: result.collections_count || 0,
          api_keys_count: result.api_keys_count || 0,
        },
      };
    }
  } catch (error) {
    console.error('[QuotaCheck] Failed to fetch quota usage:', error);
  }

  // 返回默认配额（free 套餐）
  return {
    quotas: {
      ...QUOTA_PRESETS.free,
      plan: 'free' as PlanType,
    },
    usage: {
      requests_today: 0,
      requests_this_minute: 0,
      storage_bytes: 0,
      users_count: 0,
      collections_count: 0,
      api_keys_count: 0,
    },
  };
}

/**
 * 租户配额接口
 */
interface TenantQuotas {
  max_requests_per_minute: number;
  max_requests_per_day: number;
  max_storage_bytes: number;
  max_users: number;
  max_collections: number;
  max_api_keys: number;
  plan: PlanType;
}

/**
 * 租户使用量接口
 */
interface TenantUsage {
  requests_today: number;
  requests_this_minute: number;
  storage_bytes: number;
  users_count: number;
  collections_count: number;
  api_keys_count: number;
}

/**
 * 配额状态接口（注入上下文）
 */
export interface QuotaStatus {
  quotas: TenantQuotas;
  usage: TenantUsage;
  warnings: string[];
}

/**
 * 计算整体使用率（平均值）
 */
function calculateOverallUsagePercent(
  quotas: TenantQuotas,
  usage: TenantUsage
): number {
  const percents = [
    calculateUsagePercent(usage.users_count, quotas.max_users),
    calculateUsagePercent(usage.collections_count, quotas.max_collections),
    calculateUsagePercent(usage.api_keys_count, quotas.max_api_keys),
    calculateUsagePercent(usage.storage_bytes, quotas.max_storage_bytes),
  ];

  const sum = percents.reduce((a, b) => a + b, 0);
  return Math.round((sum / percents.length) * 100) / 100;
}

/**
 * 检查特定资源的配额是否充足
 * 
 * 用于在具体操作中检查配额
 * 
 * @param c - Hono 上下文
 * @param resourceType - 资源类型（users/collections/api_keys/storage）
 * @param additionalAmount - 额外需要的数量（默认 1）
 * @returns 是否充足
 * 
 * @example
 * ```typescript
 * const isOk = await checkResourceQuota(c, 'users', 1);
 * if (!isOk) {
 *   return c.json({ error: 'QUOTA_EXCEEDED' }, 403);
 * }
 * ```
 */
export async function checkResourceQuota(
  c: Context,
  resourceType: 'users' | 'collections' | 'api_keys' | 'storage',
  additionalAmount: number = 1
): Promise<{
  ok: boolean;
  current: number;
  limit: number;
  remaining: number;
}> {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return { ok: true, current: 0, limit: Infinity, remaining: Infinity };
  }

  const { quotas, usage } = await getTenantQuotaUsage(c, tenantId);

  let current: number;
  let limit: number;

  switch (resourceType) {
    case 'users':
      current = usage.users_count;
      limit = quotas.max_users;
      break;
    case 'collections':
      current = usage.collections_count;
      limit = quotas.max_collections;
      break;
    case 'api_keys':
      current = usage.api_keys_count;
      limit = quotas.max_api_keys;
      break;
    case 'storage':
      current = usage.storage_bytes;
      limit = quotas.max_storage_bytes;
      break;
    default:
      return { ok: true, current: 0, limit: Infinity, remaining: Infinity };
  }

  const remaining = limit - current;
  const ok = remaining >= additionalAmount;

  return { ok, current, limit, remaining };
}

/**
 * 更新资源使用量
 * 
 * @param c - Hono 上下文
 * @param tenantId - 租户 ID
 * @param resourceType - 资源类型
 * @param delta - 变化量（正数增加，负数减少）
 */
export async function updateResourceUsage(
  c: Context,
  tenantId: string,
  resourceType: 'users_count' | 'collections_count' | 'api_keys_count' | 'storage_bytes',
  delta: number
): Promise<void> {
  try {
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE tenant_usage
      SET ${resourceType} = ${resourceType} + ?,
          updated_at = ?
      WHERE tenant_id = ?
    `).bind(delta, now, tenantId).run();
  } catch (error) {
    console.error('[QuotaCheck] Failed to update resource usage:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 获取配额状态（用于 API 响应）
 * 
 * @param c - Hono 上下文
 * @param tenantId - 租户 ID
 * @returns 配额状态对象
 */
export async function getQuotaStatus(c: Context, tenantId: string): Promise<{
  plan: string;
  quotas: {
    max_requests_per_minute: number;
    max_requests_per_day: number;
    max_storage_bytes: number;
    max_users: number;
    max_collections: number;
    max_api_keys: number;
  };
  usage: {
    requests_today: number;
    requests_this_minute: number;
    storage_bytes: number;
    users_count: number;
    collections_count: number;
    api_keys_count: number;
  };
  usage_percent: {
    requests_today: number;
    storage: number;
    users: number;
    collections: number;
    api_keys: number;
  };
  warnings: string[];
}> {
  const { quotas, usage } = await getTenantQuotaUsage(c, tenantId);

  const warnings: string[] = [];
  const usagePercent = {
    requests_today: calculateUsagePercent(usage.requests_today, quotas.max_requests_per_day),
    storage: calculateUsagePercent(usage.storage_bytes, quotas.max_storage_bytes),
    users: calculateUsagePercent(usage.users_count, quotas.max_users),
    collections: calculateUsagePercent(usage.collections_count, quotas.max_collections),
    api_keys: calculateUsagePercent(usage.api_keys_count, quotas.max_api_keys),
  };

  // 检查警告
  if (usagePercent.requests_today >= 80) {
    warnings.push(`Requests today: ${usagePercent.requests_today}% used`);
  }
  if (usagePercent.storage >= 80) {
    warnings.push(`Storage: ${usagePercent.storage}% used`);
  }
  if (usagePercent.users >= 80) {
    warnings.push(`Users: ${usagePercent.users}% used`);
  }
  if (usagePercent.collections >= 80) {
    warnings.push(`Collections: ${usagePercent.collections}% used`);
  }
  if (usagePercent.api_keys >= 80) {
    warnings.push(`API Keys: ${usagePercent.api_keys}% used`);
  }

  return {
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
      storage_bytes: usage.storage_bytes,
      users_count: usage.users_count,
      collections_count: usage.collections_count,
      api_keys_count: usage.api_keys_count,
    },
    usage_percent: usagePercent,
    warnings,
  };
}
