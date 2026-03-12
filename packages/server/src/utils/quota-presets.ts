/**
 * 套餐配额配置
 * 
 * 定义不同套餐的配额限制
 * 
 * @packageDocumentation
 */

/**
 * 配额预设接口
 */
export interface QuotaPreset {
  /** 每分钟最大请求数 */
  max_requests_per_minute: number;
  /** 每日最大请求数 */
  max_requests_per_day: number;
  /** 最大存储空间（字节） */
  max_storage_bytes: number;
  /** 最大用户数 */
  max_users: number;
  /** 最大集合数 */
  max_collections: number;
  /** 最大 API Key 数 */
  max_api_keys: number;
}

/**
 * 套餐类型
 */
export type PlanType = 'free' | 'pro' | 'enterprise';

/**
 * 配额预设配置
 * 
 * 定义三种套餐的配额限制：
 * - free: 免费套餐，适合个人和小项目
 * - pro: 专业套餐，适合中小企业
 * - enterprise: 企业套餐，适合大型组织
 */
export const QUOTA_PRESETS: Record<PlanType, QuotaPreset> = {
  /**
   * 免费套餐
   * 
   * 适合个人开发者和小规模项目试用
   */
  free: {
    max_requests_per_minute: 60,      // 60 次/分钟
    max_requests_per_day: 1000,       // 1000 次/天
    max_storage_bytes: 1073741824,    // 1GB
    max_users: 5,                     // 5 个用户
    max_collections: 10,              // 10 个集合
    max_api_keys: 5,                  // 5 个 API Key
  },

  /**
   * 专业套餐
   * 
   * 适合中小企业和生产环境使用
   */
  pro: {
    max_requests_per_minute: 600,     // 600 次/分钟
    max_requests_per_day: 100000,     // 10 万次/天
    max_storage_bytes: 10737418240,   // 10GB
    max_users: 50,                    // 50 个用户
    max_collections: 100,             // 100 个集合
    max_api_keys: 50,                 // 50 个 API Key
  },

  /**
   * 企业套餐
   * 
   * 适合大型组织和高并发场景
   */
  enterprise: {
    max_requests_per_minute: 6000,    // 6000 次/分钟
    max_requests_per_day: 1000000,    // 100 万次/天
    max_storage_bytes: 107374182400,  // 100GB
    max_users: 500,                   // 500 个用户
    max_collections: 1000,            // 1000 个集合
    max_api_keys: 500,                // 500 个 API Key
  },
};

/**
 * 获取套餐配额配置
 * 
 * @param plan - 套餐类型
 * @returns 配额配置对象
 * 
 * @example
 * ```typescript
 * const quotas = getQuotaPreset('pro');
 * console.log(quotas.max_requests_per_day); // 100000
 * ```
 */
export function getQuotaPreset(plan: PlanType): QuotaPreset {
  return QUOTA_PRESETS[plan] || QUOTA_PRESETS.free;
}

/**
 * 验证配额配置是否有效
 * 
 * @param preset - 配额配置对象
 * @returns 是否有效
 */
export function isValidQuotaPreset(preset: Partial<QuotaPreset>): boolean {
  const requiredFields: (keyof QuotaPreset)[] = [
    'max_requests_per_minute',
    'max_requests_per_day',
    'max_storage_bytes',
    'max_users',
    'max_collections',
    'max_api_keys',
  ];

  for (const field of requiredFields) {
    if (preset[field] === undefined || preset[field] === null) {
      return false;
    }
    if (typeof preset[field] !== 'number' || preset[field] < 0) {
      return false;
    }
  }

  return true;
}

/**
 * 合并配额配置
 * 
 * 用于自定义配额时，基于套餐预设进行覆盖
 * 
 * @param basePlan - 基础套餐类型
 * @param overrides - 覆盖的配额值
 * @returns 合并后的配额配置
 * 
 * @example
 * ```typescript
 * const customQuotas = mergeQuotaPreset('pro', {
 *   max_storage_bytes: 21474836480, // 20GB
 * });
 * ```
 */
export function mergeQuotaPreset(
  basePlan: PlanType,
  overrides: Partial<QuotaPreset>
): QuotaPreset {
  const base = getQuotaPreset(basePlan);
  return {
    ...base,
    ...overrides,
  };
}

/**
 * 格式化存储大小（人类可读）
 * 
 * @param bytes - 字节数
 * @returns 格式化后的字符串（如 "1.5 GB"）
 */
export function formatStorageSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * 计算配额使用率
 * 
 * @param used - 已使用量
 * @param limit - 配额限制
 * @returns 使用率百分比（0-100）
 */
export function calculateUsagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100 * 100) / 100);
}

/**
 * 检查配额是否接近限制
 * 
 * @param used - 已使用量
 * @param limit - 配额限制
 * @param threshold - 警告阈值（默认 80%）
 * @returns 是否接近限制
 */
export function isApproachingLimit(
  used: number,
  limit: number,
  threshold: number = 80
): boolean {
  const percent = calculateUsagePercent(used, limit);
  return percent >= threshold;
}
