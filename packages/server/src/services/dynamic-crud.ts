/**
 * Dynamic CRUD Service
 * Generates CRUD endpoints based on metadata schemas
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { errors } from '../utils/errors';
import { buildDataQuery, parseQueryParams } from '../utils/query-builder';
import { loadSchemaMetadata, buildZodSchema } from '../middleware/data-validation';

// Type definitions
type Bindings = {
  DB: any;
  KV: any;
};

type Variables = {
  tenantId: string;
  userId: string;
  schemaMetadata?: any;
  validatedData?: any;
  convertedBody?: any;
};

// Create the dynamic CRUD router
export const dynamicCrudRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'schema:metadata:';

/**
 * Get schema metadata with caching
 */
async function getCachedSchemaMetadata(
  db: any,
  kv: any,
  schemaId: string,
  tenantId: string
) {
  const cacheKey = `${CACHE_KEY_PREFIX}${tenantId}:${schemaId}`;

  // Try to get from cache
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Cache miss or error, continue to DB
    }
  }

  // Load from database
  const schemaMetadata = await loadSchemaMetadata(db, schemaId, tenantId);

  if (!schemaMetadata) {
    return null;
  }

  // Cache the result
  if (kv && schemaMetadata) {
    try {
      await kv.put(cacheKey, JSON.stringify(schemaMetadata), {
        expirationTtl: Math.floor(CACHE_TTL / 1000),
      });
    } catch (e) {
      // Cache write failed, continue anyway
    }
  }

  return schemaMetadata;
}

/**
 * Invalidate schema cache
 */
async function invalidateSchemaCache(kv: any, schemaId: string, tenantId: string) {
  if (!kv) return;

  const cacheKey = `${CACHE_KEY_PREFIX}${tenantId}:${schemaId}`;
  try {
    await kv.delete(cacheKey);
  } catch (e) {
    // Ignore cache invalidation errors
  }
}

/**
 * Schema validation middleware
 * Loads schema metadata and makes it available in context
 */
const schemaMiddleware = async (c: any, next: any) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const db = c.env.DB;
  const kv = c.env.KV;

  if (!schemaId) {
    throw errors.invalidInput({ schemaId: 'Schema ID is required' });
  }

  // Load schema metadata (with caching)
  const schemaMetadata = await getCachedSchemaMetadata(db, kv, schemaId, tenantId);

  if (!schemaMetadata) {
    throw errors.notFound('Schema');
  }

  // Store in context
  c.set('schemaMetadata', schemaMetadata);

  await next();
};

/**
 * Dynamic validation middleware
 * Validates request body against schema
 */
const validateBodyMiddleware = async (c: any, next: any) => {
  const schemaMetadata = c.get('schemaMetadata');

  if (!schemaMetadata) {
    return await next();
  }

  const body = await c.req.json().catch(() => null);

  if (!body) {
    return await next();
  }

  // Build schema and validate
  const zodSchema = buildZodSchema(schemaMetadata.fields);
  const result = zodSchema.safeParse(body);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    throw errors.invalidInput({
      fields: errorDetails,
      message: 'Validation failed',
    });
  }

  c.set('validatedData', result.data);
  await next();
};

// ==================== CRUD Endpoints ====================

/**
 * GET /api/v1/data/:schemaId
 * List all records with filtering, sorting, and pagination
 */
dynamicCrudRoutes.get('/:schemaId', schemaMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const db = c.env.DB;
  const query = c.req.query();

  // Parse query parameters
  const options = parseQueryParams(query);

  // Build query for collection_data table
  const filters = {
    ...options.filters,
    collection_id: schemaId,
    tenant_id: tenantId,
  };

  const queryResult = buildDataQuery('collection_data', {
    ...options,
    filters,
  });

  // Execute query
  const results: any = await db.prepare(queryResult.sql).bind(...queryResult.params).all();

  // Get total count
  const countResult: any = await db
    .prepare(queryResult.countSql!)
    .bind(...queryResult.countParams!)
    .first();

  // Parse JSON data fields
  const data = (results.results || []).map((row: any) => ({
    id: row.id,
    ...row.data,
    _metadata: {
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    },
  }));

  return c.json({
    data,
    pagination: {
      page: options.page || 1,
      limit: options.limit || 20,
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / (options.limit || 20)),
    },
  });
});

/**
 * GET /api/v1/data/:schemaId/:id
 * Get a single record by ID
 */
dynamicCrudRoutes.get('/:schemaId/:id', schemaMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const id = c.req.param('id');
  const db = c.env.DB;

  const record: any = await db.prepare(`
    SELECT * FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `).bind(id, schemaId, tenantId).first();

  if (!record) {
    throw errors.notFound('Record');
  }

  return c.json({
    id: record.id,
    ...record.data,
    _metadata: {
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      createdBy: record.created_by,
      updatedBy: record.updated_by,
    },
  });
});

/**
 * POST /api/v1/data/:schemaId
 * Create a new record
 */
dynamicCrudRoutes.post(
  '/:schemaId',
  schemaMiddleware,
  validateBodyMiddleware,
  async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const schemaId = c.req.param('schemaId');
    const db = c.env.DB;
    const kv = c.env.KV;

    const data = c.get('validatedData');

    const recordId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO collection_data (id, collection_id, tenant_id, data, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(recordId, schemaId, tenantId, JSON.stringify(data), userId, userId, now, now).run();

    // Invalidate cache
    await invalidateSchemaCache(kv, schemaId, tenantId);

    return c.json(
      {
        id: recordId,
        ...data,
        _metadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        },
        message: 'Record created successfully',
      },
      201
    );
  }
);

/**
 * PATCH /api/v1/data/:schemaId/:id
 * Update a record
 */
dynamicCrudRoutes.patch(
  '/:schemaId/:id',
  schemaMiddleware,
  validateBodyMiddleware,
  async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const schemaId = c.req.param('schemaId');
    const id = c.req.param('id');
    const db = c.env.DB;
    const kv = c.env.KV;

    const updateData = c.get('validatedData');

    // Get existing record
    const existing: any = await db.prepare(`
      SELECT data FROM collection_data 
      WHERE id = ? AND collection_id = ? AND tenant_id = ?
    `).bind(id, schemaId, tenantId).first();

    if (!existing) {
      throw errors.notFound('Record');
    }

    // Merge existing data with updates
    const existingData = typeof existing.data === 'string' 
      ? JSON.parse(existing.data) 
      : existing.data;
    
    const mergedData = { ...existingData, ...updateData };
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE collection_data 
      SET data = ?, updated_by = ?, updated_at = ? 
      WHERE id = ?
    `).bind(JSON.stringify(mergedData), userId, now, id).run();

    // Invalidate cache
    await invalidateSchemaCache(kv, schemaId, tenantId);

    return c.json({
      id,
      ...mergedData,
      _metadata: {
        createdAt: existing.created_at,
        updatedAt: now,
        createdBy: existing.created_by,
        updatedBy: userId,
      },
      message: 'Record updated successfully',
    });
  }
);

/**
 * DELETE /api/v1/data/:schemaId/:id
 * Delete a record
 */
dynamicCrudRoutes.delete('/:schemaId/:id', schemaMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const id = c.req.param('id');
  const db = c.env.DB;
  const kv = c.env.KV;

  const existing: any = await db.prepare(`
    SELECT id FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `).bind(id, schemaId, tenantId).first();

  if (!existing) {
    throw errors.notFound('Record');
  }

  await db.prepare(`
    DELETE FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `).bind(id, schemaId, tenantId).run();

  // Invalidate cache
  await invalidateSchemaCache(kv, schemaId, tenantId);

  return c.json({ message: 'Record deleted successfully' });
});

/**
 * POST /api/v1/data/:schemaId/bulk
 * Bulk create records
 */
dynamicCrudRoutes.post(
  '/:schemaId/bulk',
  schemaMiddleware,
  async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const schemaId = c.req.param('schemaId');
    const db = c.env.DB;
    const kv = c.env.KV;

    const body = await c.req.json();
    const items = Array.isArray(body) ? body : body.items;

    if (!Array.isArray(items) || items.length === 0) {
      throw errors.invalidInput({ items: 'Items array is required' });
    }

    // Get schema metadata for validation
    const schemaMetadata = c.get('schemaMetadata');
    const zodSchema = buildZodSchema(schemaMetadata.fields);

    const now = new Date().toISOString();
    const inserted: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = zodSchema.safeParse(item);

      if (!result.success) {
        errors.push({
          index: i,
          errors: result.error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        continue;
      }

      const recordId = crypto.randomUUID();
      
      await db.prepare(`
        INSERT INTO collection_data (id, collection_id, tenant_id, data, created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(recordId, schemaId, tenantId, JSON.stringify(result.data), userId, userId, now, now).run();

      inserted.push({
        id: recordId,
        ...result.data,
      });
    }

    // Invalidate cache
    await invalidateSchemaCache(kv, schemaId, tenantId);

    const response: any = {
      data: inserted,
      count: inserted.length,
      message: `Successfully created ${inserted.length} of ${items.length} records`,
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.failedCount = errors.length;
    }

    return c.json(response, 201);
  }
);

/**
 * Cache warming endpoint (admin only)
 * Pre-caches schema metadata
 */
dynamicCrudRoutes.post('/:schemaId/cache/warm', schemaMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const db = c.env.DB;
  const kv = c.env.KV;

  if (!kv) {
    return c.json({ message: 'Cache not available', cached: false });
  }

  const schemaMetadata = c.get('schemaMetadata');
  const cacheKey = `${CACHE_KEY_PREFIX}${tenantId}:${schemaId}`;

  await kv.put(cacheKey, JSON.stringify(schemaMetadata), {
    expirationTtl: Math.floor(CACHE_TTL / 1000),
  });

  return c.json({
    message: 'Schema metadata cached',
    cached: true,
    ttl: CACHE_TTL,
  });
});

/**
 * Cache invalidation endpoint
 * Manually invalidates schema cache
 */
dynamicCrudRoutes.delete('/:schemaId/cache', schemaMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const schemaId = c.req.param('schemaId');
  const kv = c.env.KV;

  if (!kv) {
    return c.json({ message: 'Cache not available' });
  }

  await invalidateSchemaCache(kv, schemaId, tenantId);

  return c.json({ message: 'Cache invalidated' });
});

export default dynamicCrudRoutes;
