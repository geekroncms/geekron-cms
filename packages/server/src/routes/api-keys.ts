import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { errors } from '../utils/errors';

export const apiKeysRoutes = new Hono();

// ==================== Schema Definitions ====================

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100, 'Name must be between 1 and 100 characters'),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional(),
  expiresAt: z.string().optional(), // ISO 8601 date string
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional(),
  expiresAt: z.string().optional(),
});

const validateApiKeySchema = z.object({
  key: z.string().min(1, 'API key is required'),
});

// ==================== Helper Functions ====================

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const prefix = 'gk_';
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix + key;
}

/**
 * Hash API key for storage
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== API Keys CRUD ====================

/**
 * POST /api-keys
 * Create a new API key
 */
apiKeysRoutes.post('/', zValidator('json', createApiKeySchema), async (c) => {
  const tenantId = c.get('tenantId');
  const { name, permissions = ['read'], expiresAt } = c.req.valid('json');

  // Generate API key
  const rawApiKey = generateApiKey();
  const hashedKey = await hashApiKey(rawApiKey);
  const keyId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO api_keys (id, tenant_id, name, key, permissions, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    keyId, 
    tenantId, 
    name, 
    hashedKey, 
    JSON.stringify(permissions),
    expiresAt || null,
    now
  ).run();

  // Return the raw key only once (never stored)
  return c.json({
    id: keyId,
    name,
    key: rawApiKey, // Only shown once
    permissions,
    expiresAt,
    message: 'API key created successfully. Store this key securely - it cannot be retrieved again.',
  }, 201);
});

/**
 * GET /api-keys
 * List all API keys for tenant
 */
apiKeysRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const keys: any = await c.env.DB.prepare(`
    SELECT id, name, permissions, expires_at, last_used_at, created_at 
    FROM api_keys 
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(tenantId, limit, offset).all();

  const total: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM api_keys WHERE tenant_id = ?
  `).bind(tenantId).first();

  const keyList = (keys.results || []).map((k: any) => ({
    ...k,
    permissions: typeof k.permissions === 'string' ? JSON.parse(k.permissions) : k.permissions,
    key: undefined, // Never expose the actual key
  }));

  return c.json({
    data: keyList,
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
    },
  });
});

/**
 * GET /api-keys/:id
 * Get API key info (without the actual key)
 */
apiKeysRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  const key: any = await c.env.DB.prepare(`
    SELECT id, name, permissions, expires_at, last_used_at, created_at 
    FROM api_keys 
    WHERE id = ? AND tenant_id = ?
  `).bind(keyId, tenantId).first();

  if (!key) {
    throw errors.notFound('API key');
  }

  return c.json({
    ...key,
    permissions: typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions,
  });
});

/**
 * PATCH /api-keys/:id
 * Update API key
 */
apiKeysRoutes.patch('/:id', zValidator('json', updateApiKeySchema), async (c) => {
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');
  const { name, permissions, expiresAt } = c.req.valid('json');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM api_keys WHERE id = ? AND tenant_id = ?'
  ).bind(keyId, tenantId).first();

  if (!existing) {
    throw errors.notFound('API key');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (permissions !== undefined) {
    updates.push('permissions = ?');
    values.push(JSON.stringify(permissions));
  }
  if (expiresAt !== undefined) {
    updates.push('expires_at = ?');
    values.push(expiresAt);
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' });
  }

  const query = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`;
  values.push(keyId);
  await c.env.DB.prepare(query).bind(...values).run();

  return c.json({ message: 'API key updated successfully' });
});

/**
 * DELETE /api-keys/:id
 * Delete (revoke) API key
 */
apiKeysRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM api_keys WHERE id = ? AND tenant_id = ?'
  ).bind(keyId, tenantId).first();

  if (!existing) {
    throw errors.notFound('API key');
  }

  await c.env.DB.prepare('DELETE FROM api_keys WHERE id = ?').bind(keyId).run();

  return c.json({ message: 'API key revoked successfully' });
});

/**
 * POST /api-keys/:id/rotate
 * Rotate API key (generate new key, invalidate old one)
 */
apiKeysRoutes.post('/:id/rotate', async (c) => {
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  const existing: any = await c.env.DB.prepare(
    'SELECT id, name, permissions, expires_at FROM api_keys WHERE id = ? AND tenant_id = ?'
  ).bind(keyId, tenantId).first();

  if (!existing) {
    throw errors.notFound('API key');
  }

  // Generate new key
  const rawApiKey = generateApiKey();
  const hashedKey = await hashApiKey(rawApiKey);
  const now = new Date().toISOString();

  // Update the key
  await c.env.DB.prepare(`
    UPDATE api_keys SET key = ?, last_used_at = NULL, updated_at = ? WHERE id = ?
  `).bind(hashedKey, now, keyId).run();

  return c.json({
    id: keyId,
    key: rawApiKey,
    message: 'API key rotated successfully. Store this new key securely.',
  });
});

/**
 * POST /api-keys/validate
 * Validate an API key (for external use) - does NOT update last_used_at
 */
apiKeysRoutes.post('/validate', zValidator('json', validateApiKeySchema), async (c) => {
  const { key } = c.req.valid('json');

  const hashedKey = await hashApiKey(key);
  const keyRecord: any = await c.env.DB.prepare(`
    SELECT id, tenant_id, name, permissions, expires_at, last_used_at 
    FROM api_keys WHERE key = ?
  `).bind(hashedKey).first();

  if (!keyRecord) {
    return c.json({
      valid: false,
      error: 'Invalid API key',
    });
  }

  // Check expiration
  if (keyRecord.expires_at) {
    const expiresAt = new Date(keyRecord.expires_at);
    if (expiresAt < new Date()) {
      return c.json({
        valid: false,
        error: 'API key has expired',
        expired: true,
      });
    }
  }

  // Note: This endpoint does NOT update last_used_at (non-consuming validation)
  return c.json({
    valid: true,
    keyId: keyRecord.id,
    tenantId: keyRecord.tenant_id,
    name: keyRecord.name,
    permissions: typeof keyRecord.permissions === 'string' 
      ? JSON.parse(keyRecord.permissions) 
      : keyRecord.permissions,
    expiresAt: keyRecord.expires_at,
    lastUsedAt: keyRecord.last_used_at,
  });
});

/**
 * GET /api-keys/:id/usage
 * Get API key usage statistics
 */
apiKeysRoutes.get('/:id/usage', async (c) => {
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  // Verify the key belongs to the tenant
  const keyRecord: any = await c.env.DB.prepare(`
    SELECT id, name, created_at, last_used_at, expires_at 
    FROM api_keys 
    WHERE id = ? AND tenant_id = ?
  `).bind(keyId, tenantId).first();

  if (!keyRecord) {
    throw errors.notFound('API key');
  }

  // Get usage statistics from audit_logs
  const usageStats: any = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(CASE WHEN action = 'read' THEN 1 END) as read_count,
      COUNT(CASE WHEN action = 'write' THEN 1 END) as write_count,
      COUNT(CASE WHEN action = 'delete' THEN 1 END) as delete_count,
      DATE(MIN(created_at)) as first_used_date,
      DATE(MAX(created_at)) as last_used_date
    FROM audit_logs
    WHERE tenant_id = ? AND resource_id = ?
  `).bind(tenantId, keyId).first();

  // Get recent usage (last 10 requests)
  const recentUsage: any = await c.env.DB.prepare(`
    SELECT action, resource, resource_id, created_at, ip_address
    FROM audit_logs
    WHERE tenant_id = ? AND resource_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(tenantId, keyId).all();

  return c.json({
    keyId,
    name: keyRecord.name,
    createdAt: keyRecord.created_at,
    lastUsedAt: keyRecord.last_used_at,
    expiresAt: keyRecord.expires_at,
    usage: {
      totalRequests: usageStats?.total_requests || 0,
      readCount: usageStats?.read_count || 0,
      writeCount: usageStats?.write_count || 0,
      deleteCount: usageStats?.delete_count || 0,
      firstUsedDate: usageStats?.first_used_date,
      lastUsedDate: usageStats?.last_used_date,
    },
    recentUsage: (recentUsage.results || []).map((r: any) => ({
      action: r.action,
      resource: r.resource,
      resourceId: r.resource_id,
      timestamp: r.created_at,
      ipAddress: r.ip_address,
    })),
  });
});
