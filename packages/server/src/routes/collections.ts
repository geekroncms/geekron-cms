import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { errors } from '../utils/errors';

export const collectionRoutes = new Hono();

// ==================== Schema Definitions ====================

const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  slug: z.string().regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with dashes/underscores'),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['text', 'number', 'boolean', 'date', 'json', 'relation']),
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    defaultValue: z.any().optional(),
  })).default([]),
});

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().optional(),
});

const addFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'number', 'boolean', 'date', 'json', 'relation']),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.any().optional(),
});

// ==================== Collection CRUD ====================

/**
 * POST /collections
 * Create a new data model (tenant-scoped)
 */
collectionRoutes.post('/', zValidator('json', createCollectionSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');
  const collectionId = crypto.randomUUID();

  // Check if slug already exists for this tenant
  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE slug = ? AND tenant_id = ?'
  ).bind(body.slug, tenantId).first();

  if (existing) {
    throw errors.conflict('Collection with this slug already exists');
  }

  // Create collection metadata
  await c.env.DB.prepare(`
    INSERT INTO collections (id, tenant_id, name, slug, description, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(collectionId, tenantId, body.name, body.slug, body.description || '').run();

  // Create field definitions
  for (const field of body.fields) {
    const fieldId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO collection_fields (id, collection_id, name, type, required, unique, default_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      fieldId, 
      collectionId, 
      field.name, 
      field.type, 
      field.required ? 1 : 0, 
      field.unique ? 1 : 0,
      field.defaultValue ? JSON.stringify(field.defaultValue) : null
    ).run();
  }

  return c.json({
    id: collectionId,
    name: body.name,
    slug: body.slug,
    description: body.description,
    fields: body.fields,
    message: 'Collection created successfully',
  }, 201);
});

/**
 * GET /collections
 * Get all collections for tenant
 */
collectionRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  
  const collections: any = await c.env.DB.prepare(`
    SELECT c.*, COUNT(f.id) as field_count
    FROM collections c
    LEFT JOIN collection_fields f ON c.id = f.collection_id
    WHERE c.tenant_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).bind(tenantId).all();

  return c.json({
    data: collections.results || [],
  });
});

/**
 * GET /collections/:id
 * Get single collection with fields
 */
collectionRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  
  const collection: any = await c.env.DB.prepare(`
    SELECT * FROM collections WHERE id = ? AND tenant_id = ?
  `).bind(id, tenantId).first();

  if (!collection) {
    throw errors.notFound('Collection');
  }

  const fields: any = await c.env.DB.prepare(`
    SELECT * FROM collection_fields WHERE collection_id = ?
    ORDER BY created_at ASC
  `).bind(id).all();

  return c.json({
    ...collection,
    fields: (fields.results || []).map((f: any) => ({
      ...f,
      defaultValue: f.default_value ? JSON.parse(f.default_value) : null,
    })),
  });
});

/**
 * PATCH /collections/:id
 * Update collection
 */
collectionRoutes.patch('/:id', zValidator('json', updateCollectionSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).first();

  if (!existing) {
    throw errors.notFound('Collection');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name) {
    updates.push('name = ?');
    values.push(body.name);
  }
  if (body.slug) {
    // Check slug uniqueness
    const slugExists: any = await c.env.DB.prepare(
      'SELECT id FROM collections WHERE slug = ? AND tenant_id = ? AND id != ?'
    ).bind(body.slug, tenantId, id).first();

    if (slugExists) {
      throw errors.conflict('Collection with this slug already exists');
    }
    updates.push('slug = ?');
    values.push(body.slug);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    values.push(body.description);
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' });
  }

  updates.push('updated_at = datetime(\'now\')');
  values.push(id);

  const query = `UPDATE collections SET ${updates.join(', ')} WHERE id = ?`;
  await c.env.DB.prepare(query).bind(...values).run();

  return c.json({ message: 'Collection updated successfully' });
});

/**
 * DELETE /collections/:id
 * Delete collection (cascades to fields and data)
 */
collectionRoutes.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  
  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).first();

  if (!existing) {
    throw errors.notFound('Collection');
  }

  // Delete fields first (cascade)
  await c.env.DB.prepare(`
    DELETE FROM collection_fields WHERE collection_id = ?
  `).bind(id).run();
  
  // Delete data entries (cascade)
  await c.env.DB.prepare(`
    DELETE FROM collection_data WHERE collection_id = ?
  `).bind(id).run();

  // Delete collection
  await c.env.DB.prepare(`
    DELETE FROM collections WHERE id = ? AND tenant_id = ?
  `).bind(id, tenantId).run();

  return c.json({ message: 'Collection deleted successfully' });
});

/**
 * POST /collections/:id/fields
 * Add a new field to collection
 */
collectionRoutes.post('/:id/fields', zValidator('json', addFieldSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const collectionId = c.req.param('id');
  const body = c.req.valid('json');

  // Verify collection exists
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?'
  ).bind(collectionId, tenantId).first();

  if (!collection) {
    throw errors.notFound('Collection');
  }

  const fieldId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO collection_fields (id, collection_id, name, type, required, unique, default_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    fieldId,
    collectionId,
    body.name,
    body.type,
    body.required ? 1 : 0,
    body.unique ? 1 : 0,
    body.defaultValue ? JSON.stringify(body.defaultValue) : null
  ).run();

  return c.json({
    id: fieldId,
    ...body,
    message: 'Field added successfully',
  }, 201);
});

/**
 * DELETE /collections/:collectionId/fields/:fieldId
 * Remove a field from collection
 */
collectionRoutes.delete('/:collectionId/fields/:fieldId', async (c) => {
  const tenantId = c.get('tenantId');
  const collectionId = c.req.param('collectionId');
  const fieldId = c.req.param('fieldId');

  // Verify field belongs to collection
  const field: any = await c.env.DB.prepare(`
    SELECT id FROM collection_fields 
    WHERE id = ? AND collection_id = ?
  `).bind(fieldId, collectionId).first();

  if (!field) {
    throw errors.notFound('Field');
  }

  await c.env.DB.prepare(`
    DELETE FROM collection_fields WHERE id = ?
  `).bind(fieldId).run();

  return c.json({ message: 'Field removed successfully' });
});
