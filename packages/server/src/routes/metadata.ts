import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { ApiError, errors } from '../utils/errors'
import { createLogger } from '../utils/logger'

const logger = createLogger('Metadata')

export const metadataRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * 创建元数据 Schema
 */
const createSchemaSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format')
    .default('1.0.0'),
  schema_json: z.record(z.any()).refine(val => val !== undefined, 'Schema must be a valid JSON object'),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
})

/**
 * 更新元数据 Schema
 */
const updateSchemaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  schema_json: z.record(z.any()).optional(),
  status: z.enum(['draft', 'active', 'deprecated']).optional(),
})

/**
 * 创建字段
 */
const createFieldSchema = z.object({
  field_name: z
    .string()
    .min(1, 'Field name is required')
    .max(50, 'Field name too long')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Field name must be valid identifier'),
  field_type: z.enum([
    'text',
    'number',
    'boolean',
    'date',
    'json',
    'relation',
    'email',
    'url',
    'phone',
  ]),
  field_config: z.record(z.any()).optional().default({}),
  is_required: z.boolean().default(false),
  is_unique: z.boolean().default(false),
  default_value: z.string().optional(),
  display_order: z.number().int().default(0),
  description: z.string().max(500).optional(),
})

/**
 * 更新字段
 */
const updateFieldSchema = z.object({
  field_name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .optional(),
  field_type: z
    .enum(['text', 'number', 'boolean', 'date', 'json', 'relation', 'email', 'url', 'phone'])
    .optional(),
  field_config: z.record(z.any()).optional(),
  is_required: z.boolean().optional(),
  is_unique: z.boolean().optional(),
  default_value: z.string().optional(),
  display_order: z.number().int().optional(),
  description: z.string().max(500).optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 验证 JSON Schema 格式
 */
function validateJsonSchema(schema: any): { valid: boolean; error?: string } {
  if (!schema || typeof schema !== 'object') {
    return { valid: false, error: 'Schema must be an object' }
  }

  // 基础验证：必须有 type 或 properties
  if (!schema.type && !schema.properties) {
    return { valid: false, error: 'Schema must have type or properties' }
  }

  // 验证字段类型
  const validTypes = ['string', 'number', 'boolean', 'object', 'array', 'integer', 'date']
  if (schema.type && !validTypes.includes(schema.type)) {
    return { valid: false, error: `Invalid schema type: ${schema.type}` }
  }

  return { valid: true }
}

/**
 * 验证字段类型配置
 */
function validateFieldConfig(fieldType: string, config: any): { valid: boolean; error?: string } {
  if (!config) return { valid: true }

  // 文本类型验证
  if (['text', 'email', 'url', 'phone'].includes(fieldType)) {
    if (
      config.maxLength !== undefined &&
      (typeof config.maxLength !== 'number' || config.maxLength < 0)
    ) {
      return { valid: false, error: 'maxLength must be a positive number' }
    }
    if (
      config.minLength !== undefined &&
      (typeof config.minLength !== 'number' || config.minLength < 0)
    ) {
      return { valid: false, error: 'minLength must be a positive number' }
    }
    if (config.pattern !== undefined && typeof config.pattern !== 'string') {
      return { valid: false, error: 'pattern must be a string' }
    }
  }

  // 数字类型验证
  if (['number'].includes(fieldType)) {
    if (config.min !== undefined && typeof config.min !== 'number') {
      return { valid: false, error: 'min must be a number' }
    }
    if (config.max !== undefined && typeof config.max !== 'number') {
      return { valid: false, error: 'max must be a number' }
    }
  }

  return { valid: true }
}

/**
 * 获取租户 ID（从认证中间件）
 */
function getTenantId(c: any): string {
  const tenantId = c.get('tenantId')
  if (!tenantId) {
    throw errors.invalidInput({ tenantId: 'Tenant ID is required' })
  }
  return tenantId
}

/**
 * 检查 Schema 是否存在且属于当前租户
 */
async function getSchemaById(db: D1Database, schemaId: string, tenantId: string): Promise<any> {
  const schema: any = await db
    .prepare('SELECT * FROM metadata_schemas WHERE id = ? AND tenant_id = ?')
    .bind(schemaId, tenantId)
    .first()

  if (!schema) {
    throw errors.notFound('Schema')
  }

  return schema
}

/**
 * 检查字段是否存在且属于指定 Schema
 */
async function getFieldById(db: D1Database, fieldId: string, schemaId: string): Promise<any> {
  const field: any = await db
    .prepare('SELECT * FROM metadata_fields WHERE id = ? AND schema_id = ?')
    .bind(fieldId, schemaId)
    .first()

  if (!field) {
    throw errors.notFound('Field')
  }

  return field
}

// ============================================================================
// Schema CRUD Routes
// ============================================================================

/**
 * GET /metadata/schemas
 * 获取元数据列表（分页）
 */
metadataRoutes.get('/schemas', async (c) => {
  const tenantId = getTenantId(c)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit

  const status = c.req.query('status')
  const search = c.req.query('search')

  // 构建查询条件
  let whereClause = 'tenant_id = ?'
  const params: any[] = [tenantId]

  if (status) {
    whereClause += ' AND status = ?'
    params.push(status)
  }

  if (search) {
    whereClause += ' AND (name LIKE ? OR schema_json LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  params.push(limit, offset)

  try {
    const schemas: any = await c.env.DB.prepare(
      `
      SELECT 
        id, tenant_id, name, version, schema_json, status,
        created_by, created_at, updated_at
      FROM metadata_schemas
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    )
      .bind(...params)
      .all()

    const total: any = await c.env.DB.prepare(
      `
      SELECT COUNT(*) as count FROM metadata_schemas WHERE ${whereClause}
    `,
    )
      .bind(...params.slice(0, params.length - 2))
      .first()

    return c.json({
      data: (schemas.results || []).map((s: any) => ({
        ...s,
        schema_json: typeof s.schema_json === 'string' ? JSON.parse(s.schema_json) : s.schema_json,
      })),
      pagination: {
        page,
        limit,
        total: total?.count || 0,
        totalPages: Math.ceil((total?.count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Failed to fetch schemas', error)
    throw errors.internal('Failed to fetch schemas')
  }
})

/**
 * GET /metadata/schemas/stats
 * 获取 Schema 统计信息
 */
metadataRoutes.get('/schemas/stats', async (c) => {
  const tenantId = getTenantId(c)

  try {
    const stats: any = await c.env.DB.prepare(
      `
      SELECT 
        COUNT(*) as total_schemas,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'deprecated' THEN 1 ELSE 0 END) as deprecated_count
      FROM metadata_schemas
      WHERE tenant_id = ?
    `,
    )
      .bind(tenantId)
      .first()

    return c.json({
      data: {
        total_schemas: stats?.total_schemas || 0,
        active_count: stats?.active_count || 0,
        draft_count: stats?.draft_count || 0,
        deprecated_count: stats?.deprecated_count || 0,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch schema stats', error)
    throw errors.internal('Failed to fetch stats')
  }
})

/**
 * GET /metadata/schemas/:id
 * 获取元数据详情
 */
metadataRoutes.get('/schemas/:id', async (c) => {
  const { id } = c.req.param()
  const tenantId = getTenantId(c)

  const schema = await getSchemaById(c.env.DB, id, tenantId)

  // 获取字段列表
  const fields: any = await c.env.DB.prepare(
    `
    SELECT * FROM metadata_fields
    WHERE schema_id = ?
    ORDER BY display_order, created_at ASC
  `,
  )
    .bind(id)
    .all()

  // 获取版本历史
  const versions: any = await c.env.DB.prepare(
    `
    SELECT id, version, change_summary, created_by, created_at
    FROM metadata_schema_versions
    WHERE schema_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `,
  )
    .bind(id)
    .all()

  return c.json({
    ...schema,
    schema_json:
      typeof schema.schema_json === 'string' ? JSON.parse(schema.schema_json) : schema.schema_json,
    fields: (fields.results || []).map((f: any) => ({
      ...f,
      field_config:
        typeof f.field_config === 'string' ? JSON.parse(f.field_config) : f.field_config,
    })),
    versions: versions.results || [],
  })
})

/**
 * POST /metadata/schemas
 * 创建元数据
 */
metadataRoutes.post('/schemas', zValidator('json', createSchemaSchema), async (c) => {
  const tenantId = getTenantId(c)
  const body = c.req.valid('json')

  // 验证 JSON Schema 格式
  const validation = validateJsonSchema(body.schema_json)
  if (!validation.valid) {
    throw errors.invalidInput({ message: validation.error || 'Invalid schema format' })
  }

  // 检查名称唯一性
  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM metadata_schemas WHERE tenant_id = ? AND name = ?',
  )
    .bind(tenantId, body.name)
    .first()

  if (existing) {
    throw errors.conflict('Schema name already exists')
  }

  const schemaId = `schema_${crypto.randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()
  const userId = c.get('userId') || 'system'

  try {
    await c.env.DB.prepare(
      `
      INSERT INTO metadata_schemas (
        id, tenant_id, name, version, schema_json, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        schemaId,
        tenantId,
        body.name,
        body.version || '1.0.0',
        JSON.stringify(body.schema_json),
        body.status || 'draft',
        userId,
        now,
        now,
      )
      .run()

    // 记录版本历史
    await c.env.DB.prepare(
      `
      INSERT INTO metadata_schema_versions (
        id, schema_id, version, schema_json, change_summary, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        `ver_${schemaId}_0`,
        schemaId,
        body.version || '1.0.0',
        JSON.stringify(body.schema_json),
        'Initial version',
        userId,
        now,
      )
      .run()

    return c.json(
      {
        id: schemaId,
        name: body.name,
        version: body.version || '1.0.0',
        status: body.status || 'draft',
        message: 'Schema created successfully',
      },
      201,
    )
  } catch (error) {
    logger.error('Failed to create schema', error)
    throw errors.internal('Failed to create schema')
  }
})

/**
 * PATCH /metadata/schemas/:id
 * 更新元数据
 */
metadataRoutes.patch('/schemas/:id', zValidator('json', updateSchemaSchema), async (c) => {
  const { id } = c.req.param()
  const tenantId = getTenantId(c)
  const body = c.req.valid('json')

  // 检查 Schema 是否存在
  const existing = await getSchemaById(c.env.DB, id, tenantId)

  // 验证 JSON Schema 格式（如果更新）
  if (body.schema_json) {
    const validation = validateJsonSchema(body.schema_json)
    if (!validation.valid) {
      throw errors.invalidInput({ message: validation.error || 'Invalid schema format' })
    }
  }

  // 检查名称唯一性（如果更新名称）
  if (body.name && body.name !== existing.name) {
    const nameExists: any = await c.env.DB.prepare(
      'SELECT id FROM metadata_schemas WHERE tenant_id = ? AND name = ? AND id != ?',
    )
      .bind(tenantId, body.name, id)
      .first()

    if (nameExists) {
      throw errors.conflict('Schema name already exists')
    }
  }

  // 构建更新字段
  const updates: string[] = []
  const values: any[] = []
  const now = new Date().toISOString()

  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }

  if (body.version !== undefined) {
    updates.push('version = ?')
    values.push(body.version)
  }

  if (body.schema_json !== undefined) {
    updates.push('schema_json = ?')
    values.push(JSON.stringify(body.schema_json))
  }

  if (body.status !== undefined) {
    updates.push('status = ?')
    values.push(body.status)
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' })
  }

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)

  try {
    await c.env.DB.prepare(
      `
      UPDATE metadata_schemas SET ${updates.join(', ')} WHERE id = ?
    `,
    )
      .bind(...values)
      .run()

    return c.json({
      message: 'Schema updated successfully',
      id,
    })
  } catch (error) {
    logger.error('Failed to update schema', error)
    throw new ApiError('Failed to update schema', 500)
  }
})

/**
 * DELETE /metadata/schemas/:id
 * 删除元数据
 */
metadataRoutes.delete('/schemas/:id', async (c) => {
  const { id } = c.req.param()
  const tenantId = getTenantId(c)

  // 检查 Schema 是否存在
  await getSchemaById(c.env.DB, id, tenantId)

  try {
    await c.env.DB.prepare('DELETE FROM metadata_schemas WHERE id = ?').bind(id).run()

    return c.json({
      message: 'Schema deleted successfully',
      id,
    })
  } catch (error) {
    logger.error('Failed to delete schema', error)
    throw new ApiError('Failed to delete schema', 500)
  }
})

/**
 * POST /metadata/schemas/:id/publish
 * 发布元数据（draft -> active）
 */
metadataRoutes.post('/schemas/:id/publish', async (c) => {
  const { id } = c.req.param()
  const tenantId = getTenantId(c)

  // 检查 Schema 是否存在
  const schema = await getSchemaById(c.env.DB, id, tenantId)

  if (schema.status === 'active') {
    return c.json({
      message: 'Schema is already published',
      id,
    })
  }

  if (schema.status === 'deprecated') {
    throw new ApiError('Cannot publish a deprecated schema', 400)
  }

  // 验证至少有一个字段
  const fieldCount: any = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM metadata_fields WHERE schema_id = ?',
  )
    .bind(id)
    .first()

  if (fieldCount?.count === 0) {
    throw new ApiError('Schema must have at least one field before publishing', 400)
  }

  const now = new Date().toISOString()

  try {
    await c.env.DB.prepare(
      `
      UPDATE metadata_schemas
      SET status = 'active', updated_at = ?
      WHERE id = ?
    `,
    )
      .bind(now, id)
      .run()

    return c.json({
      message: 'Schema published successfully',
      id,
      status: 'active',
    })
  } catch (error) {
    logger.error('Failed to publish schema', error)
    throw new ApiError('Failed to publish schema', 500)
  }
})

// ============================================================================
// Field Management Routes
// ============================================================================

/**
 * GET /metadata/schemas/:id/fields
 * 获取字段列表
 */
metadataRoutes.get('/schemas/:id/fields', async (c) => {
  const { id } = c.req.param()
  const tenantId = getTenantId(c)

  // 检查 Schema 是否存在
  await getSchemaById(c.env.DB, id, tenantId)

  try {
    const fields: any = await c.env.DB.prepare(
      `
      SELECT * FROM metadata_fields
      WHERE schema_id = ?
      ORDER BY display_order, created_at ASC
    `,
    )
      .bind(id)
      .all()

    return c.json({
      data: (fields.results || []).map((f: any) => ({
        ...f,
        field_config:
          typeof f.field_config === 'string' ? JSON.parse(f.field_config) : f.field_config,
      })),
    })
  } catch (error) {
    logger.error('Failed to fetch fields', error)
    throw new ApiError('Failed to fetch fields', 500)
  }
})

/**
 * POST /metadata/schemas/:id/fields
 * 添加字段
 */
metadataRoutes.post('/schemas/:id/fields', zValidator('json', createFieldSchema), async (c) => {
  const { id: schemaId } = c.req.param()
  const tenantId = getTenantId(c)
  const body = c.req.valid('json')

  // 检查 Schema 是否存在
  await getSchemaById(c.env.DB, schemaId, tenantId)

  // 验证字段配置
  const configValidation = validateFieldConfig(body.field_type, body.field_config)
  if (!configValidation.valid) {
    throw new ApiError(configValidation.error || 'Invalid field config', 400)
  }

  // 检查字段名唯一性
  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM metadata_fields WHERE schema_id = ? AND field_name = ?',
  )
    .bind(schemaId, body.field_name)
    .first()

  if (existing) {
    throw new ApiError('Field name already exists in this schema', 409)
  }

  const fieldId = `field_${crypto.randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()

  try {
    await c.env.DB.prepare(
      `
      INSERT INTO metadata_fields (
        id, schema_id, field_name, field_type, field_config, is_required, is_unique,
        default_value, display_order, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        fieldId,
        schemaId,
        body.field_name,
        body.field_type,
        JSON.stringify(body.field_config || {}),
        body.is_required ? 1 : 0,
        body.is_unique ? 1 : 0,
        body.default_value || null,
        body.display_order || 0,
        body.description || null,
        now,
        now,
      )
      .run()

    return c.json(
      {
        id: fieldId,
        schema_id: schemaId,
        field_name: body.field_name,
        field_type: body.field_type,
        message: 'Field created successfully',
      },
      201,
    )
  } catch (error) {
    logger.error('Failed to create field', error)
    throw new ApiError('Failed to create field', 500)
  }
})

/**
 * PATCH /metadata/fields/:fieldId
 * 更新字段
 */
metadataRoutes.patch('/fields/:fieldId', zValidator('json', updateFieldSchema), async (c) => {
  const { fieldId } = c.req.param()
  const tenantId = getTenantId(c)
  const body = c.req.valid('json')

  // 获取字段信息
  const field: any = await c.env.DB.prepare('SELECT * FROM metadata_fields WHERE id = ?')
    .bind(fieldId)
    .first()

  if (!field) {
    throw errors.notFound('Field')
  }

  // 验证 Schema 属于当前租户
  await getSchemaById(c.env.DB, field.schema_id, tenantId)

  // 验证字段配置
  if (body.field_config) {
    const configValidation = validateFieldConfig(
      body.field_type || field.field_type,
      body.field_config,
    )
    if (!configValidation.valid) {
      throw new ApiError(configValidation.error || 'Invalid field config', 400)
    }
  }

  // 检查字段名唯一性（如果更新）
  if (body.field_name && body.field_name !== field.field_name) {
    const nameExists: any = await c.env.DB.prepare(
      'SELECT id FROM metadata_fields WHERE schema_id = ? AND field_name = ? AND id != ?',
    )
      .bind(field.schema_id, body.field_name, fieldId)
      .first()

    if (nameExists) {
      throw new ApiError('Field name already exists in this schema', 409)
    }
  }

  // 构建更新字段
  const updates: string[] = []
  const values: any[] = []
  const now = new Date().toISOString()

  if (body.field_name !== undefined) {
    updates.push('field_name = ?')
    values.push(body.field_name)
  }

  if (body.field_type !== undefined) {
    updates.push('field_type = ?')
    values.push(body.field_type)
  }

  if (body.field_config !== undefined) {
    updates.push('field_config = ?')
    values.push(JSON.stringify(body.field_config))
  }

  if (body.is_required !== undefined) {
    updates.push('is_required = ?')
    values.push(body.is_required ? 1 : 0)
  }

  if (body.is_unique !== undefined) {
    updates.push('is_unique = ?')
    values.push(body.is_unique ? 1 : 0)
  }

  if (body.default_value !== undefined) {
    updates.push('default_value = ?')
    values.push(body.default_value)
  }

  if (body.display_order !== undefined) {
    updates.push('display_order = ?')
    values.push(body.display_order)
  }

  if (body.description !== undefined) {
    updates.push('description = ?')
    values.push(body.description)
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' })
  }

  updates.push('updated_at = ?')
  values.push(now)
  values.push(fieldId)

  try {
    await c.env.DB.prepare(
      `
      UPDATE metadata_fields SET ${updates.join(', ')} WHERE id = ?
    `,
    )
      .bind(...values)
      .run()

    return c.json({
      message: 'Field updated successfully',
      id: fieldId,
    })
  } catch (error) {
    logger.error('Failed to update field', error)
    throw new ApiError('Failed to update field', 500)
  }
})

/**
 * DELETE /metadata/fields/:fieldId
 * 删除字段
 */
metadataRoutes.delete('/fields/:fieldId', async (c) => {
  const { fieldId } = c.req.param()
  const tenantId = getTenantId(c)

  // 获取字段信息
  const field: any = await c.env.DB.prepare('SELECT schema_id FROM metadata_fields WHERE id = ?')
    .bind(fieldId)
    .first()

  if (!field) {
    throw errors.notFound('Field')
  }

  // 验证 Schema 属于当前租户
  await getSchemaById(c.env.DB, field.schema_id, tenantId)

  try {
    await c.env.DB.prepare('DELETE FROM metadata_fields WHERE id = ?').bind(fieldId).run()

    return c.json({
      message: 'Field deleted successfully',
      id: fieldId,
    })
  } catch (error) {
    logger.error('Failed to delete field', error)
    throw new ApiError('Failed to delete field', 500)
  }
})

// ============================================================================
// Schema Validation Endpoint
// ============================================================================

/**
 * POST /metadata/validate
 * 验证 Schema 是否符合 JSON Schema 规范
 */
metadataRoutes.post('/validate', async (c) => {
  const body = await c.req.json()
  const { schema_json } = body

  if (!schema_json || typeof schema_json !== 'object') {
    throw new ApiError('schema_json is required and must be an object', 400)
  }

  const validation = validateJsonSchema(schema_json)

  return c.json({
    valid: validation.valid,
    error: validation.error,
    schema: schema_json,
  })
})
