import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { errors } from '../utils/errors'

export const collectionDataRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>

// ==================== Schema Definitions ====================

const createDataSchema = z.object({
  collectionId: z.string().uuid('Invalid collection ID'),
  data: z.record(z.any()),
})

const updateDataSchema = z.object({
  data: z.record(z.any()),
})

const querySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  filter: z.string().optional(), // JSON string for filtering
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

// ==================== Collection Data CRUD ====================

/**
 * POST /data
 * Create a new data entry in a collection
 */
collectionDataRoutes.post('/', zValidator('json', createDataSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const { collectionId, data } = c.req.valid('json')

  // Verify collection exists and belongs to tenant
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  const dataId = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    `
    INSERT INTO collection_data (id, collection_id, tenant_id, data, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  )
    .bind(dataId, collectionId, tenantId, JSON.stringify(data), userId, userId, now, now)
    .run()

  // Fetch the created record
  const created: any = await c.env.DB.prepare('SELECT * FROM collection_data WHERE id = ?')
    .bind(dataId)
    .first()

  return c.json(
    {
      ...created,
      data: typeof created.data === 'string' ? JSON.parse(created.data) : created.data,
      message: 'Data entry created successfully',
    },
    201,
  )
})

/**
 * GET /data/:collectionId
 * List all data entries in a collection
 */
collectionDataRoutes.get('/:collectionId', zValidator('query', querySchema), async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')
  const { page = '1', limit = '20', filter, sort, order = 'desc' } = c.req.valid('query')

  // Verify collection exists
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const offset = (pageNum - 1) * limitNum

  let whereClause = 'WHERE collection_id = ? AND tenant_id = ?'
  const params: any[] = [collectionId, tenantId]

  // Apply filter if provided
  if (filter) {
    try {
      const filterObj = JSON.parse(filter)
      // Simple filter implementation - can be extended
      for (const [key, value] of Object.entries(filterObj)) {
        whereClause += ` AND json_extract(data, '$.${key}') = ?`
        params.push(typeof value === 'string' ? value : JSON.stringify(value))
      }
    } catch (e) {
      throw errors.invalidInput({ filter: 'Invalid filter JSON' })
    }
  }

  // Apply sorting
  let orderBy = 'ORDER BY created_at ' + order.toUpperCase()
  if (sort) {
    orderBy = `ORDER BY json_extract(data, '$.${sort}') ${order.toUpperCase()}`
  }

  const query = `
    SELECT * FROM collection_data 
    ${whereClause} 
    ${orderBy}
    LIMIT ? OFFSET ?
  `
  params.push(limitNum, offset)

  const results: any = await c.env.DB.prepare(query)
    .bind(...params)
    .all()

  const total: any = await c.env.DB.prepare(
    `
    SELECT COUNT(*) as count FROM collection_data ${whereClause}
  `,
  )
    .bind(...params.slice(0, params.length - 2))
    .first()

  const data = (results.results || []).map((row: any) => ({
    ...row,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
  }))

  return c.json({
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limitNum),
    },
  })
})

/**
 * GET /data/:collectionId/:id
 * Get a single data entry
 */
collectionDataRoutes.get('/:collectionId/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')
  const dataId = c.req.param('id')

  const data: any = await c.env.DB.prepare(
    `
    SELECT * FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `,
  )
    .bind(dataId, collectionId, tenantId)
    .first()

  if (!data) {
    throw errors.notFound('Data entry')
  }

  return c.json({
    ...data,
    data: typeof data.data === 'string' ? JSON.parse(data.data) : data.data,
  })
})

/**
 * PATCH /data/:collectionId/:id
 * Update a data entry
 */
collectionDataRoutes.patch(
  '/:collectionId/:id',
  zValidator('json', updateDataSchema),
  async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const collectionId = c.req.param('collectionId')
    const dataId = c.req.param('id')
    const { data: updateData } = c.req.valid('json')

    // Verify data entry exists
    const existing: any = await c.env.DB.prepare(
      `
    SELECT data FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `,
    )
      .bind(dataId, collectionId, tenantId)
      .first()

    if (!existing) {
      throw errors.notFound('Data entry')
    }

    // Merge existing data with updates
    const existingData =
      typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data

    const mergedData = { ...existingData, ...updateData }
    const now = new Date().toISOString()

    await c.env.DB.prepare(
      `
    UPDATE collection_data 
    SET data = ?, updated_by = ?, updated_at = ? 
    WHERE id = ?
  `,
    )
      .bind(JSON.stringify(mergedData), userId, now, dataId)
      .run()

    const updated: any = await c.env.DB.prepare('SELECT * FROM collection_data WHERE id = ?')
      .bind(dataId)
      .first()

    return c.json({
      ...updated,
      data: typeof updated.data === 'string' ? JSON.parse(updated.data) : updated.data,
      message: 'Data entry updated successfully',
    })
  },
)

/**
 * DELETE /data/:collectionId/:id
 * Delete a data entry
 */
collectionDataRoutes.delete('/:collectionId/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')
  const dataId = c.req.param('id')

  const existing: any = await c.env.DB.prepare(
    `
    SELECT id FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `,
  )
    .bind(dataId, collectionId, tenantId)
    .first()

  if (!existing) {
    throw errors.notFound('Data entry')
  }

  await c.env.DB.prepare(
    `
    DELETE FROM collection_data 
    WHERE id = ? AND collection_id = ? AND tenant_id = ?
  `,
  )
    .bind(dataId, collectionId, tenantId)
    .run()

  return c.json({ message: 'Data entry deleted successfully' })
})

/**
 * POST /data/:collectionId/bulk
 * Bulk create data entries
 */
collectionDataRoutes.post('/:collectionId/bulk', async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const collectionId = c.req.param('collectionId')

  const body = await c.req.json()
  const items = Array.isArray(body) ? body : body.items

  if (!Array.isArray(items) || items.length === 0) {
    throw errors.invalidInput({ items: 'Items array is required' })
  }

  // Verify collection exists
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  const now = new Date().toISOString()
  const inserted: any[] = []

  // Batch insert (SQLite supports multiple values in one INSERT)
  for (const item of items) {
    const dataId = crypto.randomUUID()
    await c.env.DB.prepare(
      `
      INSERT INTO collection_data (id, collection_id, tenant_id, data, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(dataId, collectionId, tenantId, JSON.stringify(item), userId, userId, now, now)
      .run()

    inserted.push({ id: dataId, ...item })
  }

  return c.json(
    {
      data: inserted,
      count: inserted.length,
      message: `Successfully created ${inserted.length} entries`,
    },
    201,
  )
})
