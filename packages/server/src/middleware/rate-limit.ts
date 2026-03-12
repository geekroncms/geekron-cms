import { Context, Next } from 'hono';
import { QUOTA_PRESETS, PlanType } from '../utils/quota-presets';

/**
 * 限流中间件
 * 
 * 功能：
 * 1. 基于租户的限流（X-Tenant-ID 或 JWT 中的 tenant_id）
 * 2. 每分钟请求数限制（滑动窗口）
 * 3. 每日请求数限制
 * 4. 超限返回 429 Too Many Requests
 * 5. 返回限流 Headers（X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset）
 * 
 * @param c - Hono 上下文
 * @param next - 下一个中间件
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  // 跳过限流的路由
  const skipPaths = ['/health', '/health/ready', '/auth/login', '/auth/register'];
  if (skipPaths.some(path => c.req.path.startsWith(path))) {
    return await next();
  }

  // 获取租户 ID
  const tenantId = getTenantId(c);
  if (!tenantId) {
    // 没有租户 ID，跳过限流（可能是公开路由）
    return await next();
  }

  // 获取租户配额（从上下文或数据库）
  const quotas = await getTenantQuotas(c, tenantId);
  
  // 限流检查
  const now = Date.now();
  const minuteKey = `rate:${tenantId}:minute:${Math.floor(now / 60000)}`;
  const dayKey = `rate:${tenantId}:day:${new Date().toISOString().split('T')[0]}`;

  // 检查每分钟限流
  const minuteLimit = quotas.max_requests_per_minute;
  const minuteCount = await incrementCounter(c, minuteKey, 60000);
  
  // 检查每日限流
  const dayLimit = quotas.max_requests_per_day;
  const dayCount = await incrementCounter(c, dayKey, 86400000);

  // 计算限流 Headers
  const minuteRemaining = Math.max(0, minuteLimit - minuteCount);
  const minuteReset = Math.ceil((Math.floor(now / 60000) + 1) * 60000 - now);
  
  const dayRemaining = Math.max(0, dayLimit - dayCount);
  const dayReset = getDayResetMilliseconds();

  // 设置限流 Headers
  c.header('X-RateLimit-Limit', minuteLimit.toString());
  c.header('X-RateLimit-Remaining', minuteRemaining.toString());
  c.header('X-RateLimit-Reset', minuteReset.toString());
  
  // 添加每日限流 Headers
  c.header('X-RateLimit-Daily-Limit', dayLimit.toString());
  c.header('X-RateLimit-Daily-Remaining', dayRemaining.toString());
  c.header('X-RateLimit-Daily-Reset', dayReset.toString());

  // 检查是否超限
  if (minuteCount > minuteLimit) {
    c.header('Retry-After', minuteReset.toString());
    return c.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
        retry_after: minuteReset,
        limit: minuteLimit,
        remaining: 0,
        reset: minuteReset,
      },
      429
    );
  }

  if (dayCount > dayLimit) {
    c.header('Retry-After', dayReset.toString());
    return c.json(
      {
        error: 'DAILY_LIMIT_EXCEEDED',
        message: 'Daily request limit exceeded. Please try again tomorrow.',
        retry_after: dayReset,
        limit: dayLimit,
        remaining: 0,
        reset: dayReset,
      },
      429
    );
  }

  // 更新数据库中的使用量（异步，不阻塞请求）
  updateTenantUsage(c, tenantId).catch(err => {
    console.error('[RateLimit] Failed to update tenant usage:', err);
  });

  await next();
}

/**
 * 从请求中获取租户 ID
 * 
 * 优先级：
 * 1. 上下文变量（来自 auth middleware）
 * 2. X-Tenant-ID Header
 * 3. JWT Token 中的 tenant_id
 */
function getTenantId(c: Context): string | null {
  // 尝试从上下文获取（auth middleware 已设置）
  const tenantIdFromContext = c.get('tenantId');
  if (tenantIdFromContext) {
    return tenantIdFromContext;
  }

  // 尝试从 Header 获取
  const tenantIdFromHeader = c.req.header('X-Tenant-ID');
  if (tenantIdFromHeader) {
    return tenantIdFromHeader;
  }

  return null;
}

/**
 * 获取租户配额
 * 
 * 优先从上下文获取，如果没有则从数据库查询
 */
async function getTenantQuotas(c: Context, tenantId: string): Promise<{
  max_requests_per_minute: number;
  max_requests_per_day: number;
}> {
  // 尝试从上下文获取（如果前面 middleware 已设置）
  const tenant = c.get('tenant');
  if (tenant?.plan) {
    const plan = tenant.plan as PlanType;
    const preset = QUOTA_PRESETS[plan] || QUOTA_PRESETS.free;
    return {
      max_requests_per_minute: preset.max_requests_per_minute,
      max_requests_per_day: preset.max_requests_per_day,
    };
  }

  // 从数据库查询
  try {
    const quota: any = await c.env.DB.prepare(`
      SELECT max_requests_per_minute, max_requests_per_day
      FROM tenant_quotas
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    if (quota) {
      return {
        max_requests_per_minute: quota.max_requests_per_minute,
        max_requests_per_day: quota.max_requests_per_day,
      };
    }
  } catch (error) {
    console.error('[RateLimit] Failed to fetch quotas:', error);
  }

  // 返回默认配额（free 套餐）
  return {
    max_requests_per_minute: QUOTA_PRESETS.free.max_requests_per_minute,
    max_requests_per_day: QUOTA_PRESETS.free.max_requests_per_day,
  };
}

/**
 * 递增计数器（使用 KV 存储或内存）
 * 
 * @param c - Hono 上下文
 * @param key - 计数器键
 * @param ttlMs - 过期时间（毫秒）
 * @returns 当前计数值
 */
async function incrementCounter(
  c: Context,
  key: string,
  ttlMs: number
): Promise<number> {
  // 优先使用 KV 存储（如果可用）
  if (c.env.KV) {
    try {
      const current = await c.env.KV.get(key);
      const count = current ? parseInt(current) + 1 : 1;
      await c.env.KV.put(key, count.toString(), {
        expirationTtl: Math.ceil(ttlMs / 1000),
      });
      return count;
    } catch (error) {
      console.error('[RateLimit] KV storage error:', error);
      // 降级到内存存储
    }
  }

  // 降级到内存存储（使用 WeakMap 或全局 Map）
  const memoryStore = getMemoryStore();
  const now = Date.now();
  
  const record = memoryStore.get(key);
  if (!record || now > record.expiresAt) {
    memoryStore.set(key, { count: 1, expiresAt: now + ttlMs });
    return 1;
  }
  
  record.count++;
  return record.count;
}

/**
 * 获取内存存储（单例）
 */
function getMemoryStore(): Map<string, { count: number; expiresAt: number }> {
  // @ts-ignore - 全局存储
  if (!global.__rateLimitStore) {
    // @ts-ignore
    global.__rateLimitStore = new Map();
  }
  // @ts-ignore
  return global.__rateLimitStore;
}

/**
 * 获取每日重置的毫秒数
 */
function getDayResetMilliseconds(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

/**
 * 更新租户使用量（数据库）
 * 
 * @param c - Hono 上下文
 * @param tenantId - 租户 ID
 */
async function updateTenantUsage(c: Context, tenantId: string): Promise<void> {
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 检查是否需要重置每日计数器
    const usage: any = await c.env.DB.prepare(`
      SELECT reset_date, requests_today
      FROM tenant_usage
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    if (usage) {
      let requestsToday = usage.requests_today || 0;
      let resetDate = usage.reset_date || today;

      // 如果日期已变更，重置计数器
      if (resetDate !== today) {
        requestsToday = 1;
        resetDate = today;
      } else {
        requestsToday++;
      }

      await c.env.DB.prepare(`
        UPDATE tenant_usage
        SET requests_today = ?,
            reset_date = ?,
            last_request_at = ?,
            updated_at = ?
        WHERE tenant_id = ?
      `).bind(requestsToday, resetDate, now, now, tenantId).run();
    } else {
      // 如果使用量记录不存在，创建一条
      await c.env.DB.prepare(`
        INSERT INTO tenant_usage (
          id, tenant_id, requests_today, requests_this_minute,
          reset_date, last_request_at, updated_at
        ) VALUES (?, ?, 1, 1, ?, ?, ?)
      `).bind(`usage_${tenantId}`, tenantId, today, now, now).run();
    }
  } catch (error) {
    console.error('[RateLimit] Failed to update usage:', error);
    // 不抛出错误，避免影响请求
  }
}

/**
 * 获取当前限流状态
 * 
 * 用于在响应中返回限流信息
 * 
 * @param c - Hono 上下文
 * @param tenantId - 租户 ID
 * @returns 限流状态对象
 */
export async function getRateLimitStatus(
  c: Context,
  tenantId: string
): Promise<{
  requests_this_minute: number;
  requests_today: number;
  limit_per_minute: number;
  limit_per_day: number;
  remaining_this_minute: number;
  remaining_today: number;
}> {
  const quotas = await getTenantQuotas(c, tenantId);
  
  // 从数据库获取使用量
  const usage: any = await c.env.DB.prepare(`
    SELECT requests_today, requests_this_minute
    FROM tenant_usage
    WHERE tenant_id = ?
  `).bind(tenantId).first();

  const requestsToday = usage?.requests_today || 0;
  const requestsThisMinute = usage?.requests_this_minute || 0;

  return {
    requests_this_minute: requestsThisMinute,
    requests_today: requestsToday,
    limit_per_minute: quotas.max_requests_per_minute,
    limit_per_day: quotas.max_requests_per_day,
    remaining_this_minute: Math.max(0, quotas.max_requests_per_minute - requestsThisMinute),
    remaining_today: Math.max(0, quotas.max_requests_per_day - requestsToday),
  };
}
