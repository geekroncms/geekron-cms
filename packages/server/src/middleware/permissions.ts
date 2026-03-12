import { Context, Next } from 'hono';
import { hasPermission } from './api-key-auth';

/**
 * 权限检查中间件
 * 
 * 检查用户/API Key 是否有指定权限
 * 支持权限组合检查（OR/AND）
 * 无权限时返回 403 Forbidden
 * 
 * 用法：
 * - 单个权限：permissionsMiddleware(['read'])
 * - 多个权限（OR）：permissionsMiddleware(['read', 'write'], 'OR')
 * - 多个权限（AND）：permissionsMiddleware(['read', 'write'], 'AND')
 */
export function permissionsMiddleware(
  requiredPermissions: string | string[],
  mode: 'AND' | 'OR' = 'OR'
) {
  return async (c: Context, next: Next) => {
    const permissions = c.get('permissions') || [];
    const role = c.get('role');
    const authMethod = c.get('authMethod') || 'jwt';

    // 管理员角色拥有所有权限
    if (role === 'admin' || role === 'owner') {
      await next();
      return;
    }

    // API Key 的 admin 权限
    if (authMethod === 'api_key' && permissions.includes('admin')) {
      await next();
      return;
    }

    // 标准化权限列表
    const requiredList = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];

    // 检查权限
    const hasAccess = hasPermission(requiredList, permissions, mode);

    if (!hasAccess) {
      return c.json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Required permissions: ${requiredList.join(', ')}`,
        required: requiredList,
        mode,
        available: permissions,
      }, 403);
    }

    await next();
  };
}

/**
 * 权限检查助手函数
 * 可在路由处理器中直接使用
 */
export function checkPermissions(
  c: Context,
  requiredPermissions: string | string[],
  mode: 'AND' | 'OR' = 'OR'
): { hasAccess: boolean; missing?: string[] } {
  const permissions = c.get('permissions') || [];
  const role = c.get('role');

  // 管理员角色拥有所有权限
  if (role === 'admin' || role === 'owner') {
    return { hasAccess: true };
  }

  const requiredList = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];

  const hasAccess = hasPermission(requiredList, permissions, mode);

  if (!hasAccess) {
    const missing = requiredList.filter(p => !permissions.includes(p));
    return { hasAccess: false, missing };
  }

  return { hasAccess: true };
}

/**
 * 基于角色的权限检查
 * 某些角色自动拥有特定权限
 */
export const rolePermissions: Record<string, string[]> = {
  owner: ['read', 'write', 'delete', 'admin'],
  admin: ['read', 'write', 'delete', 'admin'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

/**
 * 检查角色是否有权限
 */
export function hasRolePermission(role: string, permission: string): boolean {
  const rolePerms = rolePermissions[role] || [];
  return rolePerms.includes(permission);
}

/**
 * 动态权限检查中间件
 * 根据资源类型和操作动态检查权限
 */
export function dynamicPermissionsMiddleware(
  resourceType: string,
  operation: 'read' | 'write' | 'delete' | 'admin'
) {
  return async (c: Context, next: Next) => {
    const permissions = c.get('permissions') || [];
    const role = c.get('role');

    // 管理员拥有所有权限
    if (role === 'admin' || role === 'owner') {
      await next();
      return;
    }

    // 检查是否有对应操作的权限
    if (!permissions.includes(operation) && !permissions.includes('admin')) {
      return c.json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Permission '${operation}' required for ${resourceType}`,
        resource: resourceType,
        operation,
      }, 403);
    }

    await next();
  };
}
