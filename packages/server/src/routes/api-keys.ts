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
 * Validate an API key (for external use)
 */
apiKeysRoutes.post('/validate', async (c) => {
  const { key } = await c.req.json();

  if (!key) {
    throw errors.invalidInput({ key: 'API key is required' });
  }

  const hashedKey = await hashApiKey(key);
  const keyRecord: any = await c.env.DB.prepare(`
    SELECT id, tenant_id, name, permissions, expires_at, last_used_at 
    FROM api_keys WHERE key = ?
  `).bind(hashedKey).first();

  if (!keyRecord) {
    throw errors.unauthorized('Invalid API key');
  }

  // Check expiration
  if (keyRecord.expires_at) {
    const expiresAt = new Date(keyRecord.expires_at);
    if (expiresAt < new Date()) {
      throw errors.unauthorized('API key has expired');
    }
  }

  // Update last used timestamp
  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE api_keys SET last_used_at = ? WHERE id = ?
  `).bind(now, keyRecord.id).run();

  return c.json({
    valid: true,
    keyId: keyRecord.id,
    tenantId: keyRecord.tenant_id,
    name: keyRecord.name,
    permissions: typeof keyRecord.permissions === 'string' 
      ? JSON.parse(keyRecord.permissions) 
      : keyRecord.permissions,
  });
});
