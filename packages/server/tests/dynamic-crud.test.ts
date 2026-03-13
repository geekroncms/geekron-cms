/**
 * Dynamic CRUD API Tests
 * Tests for dynamic route generation, CRUD operations, query parameters,
 * data validation, caching, and tenant isolation
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { buildZodSchema } from '../src/middleware/data-validation'
import { dynamicCrudRoutes } from '../src/services/dynamic-crud'
import { buildDataQuery, buildWhereClause, parseQueryParams } from '../src/utils/query-builder'
import { ApiError } from '../src/utils/errors'

// Mock prepared statement
class MockPreparedStatement {
  private query: string
  private db: MockDB

  constructor(query: string, db: MockDB) {
    this.query = query
    this.db = db
  }

  bind(...params: any[]) {
    return {
      first: async () => {
        // Mock implementation
        if (this.query.includes('FROM collections') && this.query.includes('WHERE')) {
          // Query: SELECT * FROM collections WHERE id = ? AND tenant_id = ?
          const collectionId = params[0]
          const tenantId = params[1]
          const collection = this.db.collections.get(`${tenantId}:${collectionId}`)
          if (collection) {
            // Return with proper field names
            return {
              id: collection.id,
              tenant_id: collection.tenant_id,
              name: collection.name,
              slug: collection.slug,
              ...collection,
            }
          }
          return null
        }
        if (this.query.includes('SELECT * FROM collection_fields')) {
          const collectionId = params[0]
          const results = Array.from(this.db.fields.values()).filter(
            (f) => f.collection_id === collectionId,
          )
          return { results }
        }
        if (this.query.includes('FROM collection_data') && this.query.includes('WHERE id = ?')) {
          // Query: SELECT * FROM collection_data WHERE id = ? AND collection_id = ? AND tenant_id = ?
          const recordId = params[0]
          const record = this.db.data.get(recordId)
          if (record) {
            // Return data as object (service expects to spread it)
            return {
              id: record.id,
              collection_id: record.collection_id,
              tenant_id: record.tenant_id,
              created_by: record.created_by,
              updated_by: record.updated_by,
              created_at: record.created_at,
              updated_at: record.updated_at,
              data: record.data, // Return as object, not string
            }
          }
          return null
        }
        if (this.query.includes('COUNT(*)')) {
          const collectionId = params[0]
          const tenantId = params[1]
          const count = Array.from(this.db.data.values()).filter(
            (d) => d.collection_id === collectionId && d.tenant_id === tenantId,
          ).length
          return { count }
        }
        return null
      },
      all: async () => {
        if (this.query.includes('FROM collection_data') && this.query.includes('WHERE')) {
          // Dynamic CRUD query with filters
          // Query format: SELECT t.* FROM collection_data t WHERE t.collection_id = ? AND t.tenant_id = ? ... ORDER BY ... LIMIT ? OFFSET ?
          // We need to parse the query to extract collection_id, tenant_id, and handle pagination/sorting

          // Extract collection_id and tenant_id from the query params
          // The WHERE clause has: collection_id = ? AND tenant_id = ? AND [additional filters]
          // Params: [collection_id, tenant_id, ...filterValues, limit, offset]
          
          // Parse LIMIT and OFFSET from the end of params
          // Find LIMIT and OFFSET in the query to determine param positions
          const limitMatch = this.query.match(/LIMIT\s+\?/i)
          const offsetMatch = this.query.match(/OFFSET\s+\?/i)
          
          let limit = 20
          let offset = 0
          let whereParams = params
          
          if (limitMatch && offsetMatch) {
            // Last two params are limit and offset
            limit = params[params.length - 2]
            offset = params[params.length - 1]
            whereParams = params.slice(0, params.length - 2)
          } else if (limitMatch) {
            // Last param is limit
            limit = params[params.length - 1]
            whereParams = params.slice(0, params.length - 1)
          }

          // Params order: [filter values..., collection_id, tenant_id]
          // The last two whereParams are collection_id and tenant_id
          const tenantId = whereParams[whereParams.length - 1]
          const collectionId = whereParams[whereParams.length - 2]
          const filterValues = whereParams.slice(0, whereParams.length - 2)
          
          // Filter data by collection_id and tenant_id
          let results = Array.from(this.db.data.values()).filter(
            (d) => d.collection_id === collectionId && d.tenant_id === tenantId
          )

          // Apply additional filters from params (if any)
          // The filterValues array contains the filter values in order
          // We need to parse the WHERE clause to understand what filters to apply
          if (filterValues.length > 0) {
            // Extract WHERE clause - be more careful with parsing
            const whereMatch = this.query.match(/WHERE\s+(.+?)\s+(?:ORDER\s+BY|LIMIT|$)/is)
            if (whereMatch) {
              const whereClause = whereMatch[1].trim()
              // Parse individual conditions - split on AND but be careful with spacing
              const conditions = whereClause.split(/\s+AND\s+/i).map(c => c.trim()).filter(c => c)
              
              // Skip the last two conditions (collection_id and tenant_id)
              const filterConditions = conditions.slice(0, conditions.length - 2)
              let filterParamIndex = 0
              
              for (const condition of filterConditions) {
                if (!condition || condition === '') continue
                
                // Parse condition: t.field = ? or t.field IN (?, ?) etc.
                // More robust regex
                const fieldMatch = condition.match(/t\.(\w+)\s*(=|IN|>|<|>=|<=|!=|LIKE)/i)
                if (fieldMatch && filterParamIndex < filterValues.length) {
                  const fieldName = fieldMatch[1]
                  const operator = fieldMatch[2].toUpperCase()
                  const filterValue = filterValues[filterParamIndex++]
                  
                  // Apply filter based on operator
                  if (operator === 'IN') {
                    // IN clause - filterValue might be an array or need special handling
                    results = results.filter((r) => {
                      const dataValue = r.data[fieldName]
                      return Array.isArray(filterValue) ? filterValue.includes(dataValue) : dataValue === filterValue
                    })
                  } else if (operator === 'LIKE') {
                    // LIKE clause
                    const likePattern = String(filterValue).replace(/%/g, '.*')
                    const regex = new RegExp(likePattern, 'i')
                    results = results.filter((r) => {
                      const dataValue = r.data[fieldName]
                      return dataValue !== undefined && regex.test(String(dataValue))
                    })
                  } else {
                    // Equality filter (=, !=, >, <, >=, <=)
                    results = results.filter((r) => {
                      const dataValue = r.data[fieldName]
                      if (dataValue === undefined) return false
                      switch (operator) {
                        case '!=':
                        case '<>':
                          return dataValue !== filterValue
                        case '>':
                          return dataValue > filterValue
                        case '>=':
                          return dataValue >= filterValue
                        case '<':
                          return dataValue < filterValue
                        case '<=':
                          return dataValue <= filterValue
                        default: // '='
                          return dataValue === filterValue
                      }
                    })
                  }
                }
              }
            }
          }

          // Apply sorting
          const orderMatch = this.query.match(/ORDER\s+BY\s+(?:t\.)?(\w+)(?:\s+(ASC|DESC))?/i)
          if (orderMatch) {
            const sortField = orderMatch[1]
            const sortOrder = orderMatch[2]?.toLowerCase() || 'asc'
            
            results.sort((a, b) => {
              const aVal = a.data[sortField] ?? a[sortField]
              const bVal = b.data[sortField] ?? b[sortField]
              
              if (aVal === bVal) return 0
              if (sortOrder === 'desc') {
                return aVal > bVal ? -1 : 1
              }
              return aVal > bVal ? 1 : -1
            })
          }

          // Apply pagination
          results = results.slice(offset, offset + limit)

          // Transform results to match expected format (data as object)
          const transformedResults = results.map((r) => ({
            id: r.id,
            collection_id: r.collection_id,
            tenant_id: r.tenant_id,
            created_by: r.created_by,
            updated_by: r.updated_by,
            created_at: r.created_at,
            updated_at: r.updated_at,
            data: r.data, // Keep as object
          }))

          return { results: transformedResults }
        }
        if (this.query.includes('SELECT * FROM collection_fields')) {
          const collectionId = params[0]
          const results = Array.from(this.db.fields.values()).filter(
            (f) => f.collection_id === collectionId,
          )
          return { results }
        }
        return { results: [] }
      },
      run: async () => {
        // Mock INSERT/UPDATE/DELETE
        if (this.query.includes('INSERT INTO collection_data')) {
          const id = params[0]
          const data = JSON.parse(params[3])
          this.db.data.set(id, {
            id,
            collection_id: params[1],
            tenant_id: params[2],
            data,
            created_by: params[4],
            updated_by: params[5],
            created_at: params[6],
            updated_at: params[7],
          })
        }
        if (this.query.includes('DELETE FROM collection_data')) {
          const id = params[0]
          this.db.data.delete(id)
        }
        return { success: true }
      },
    }
  }
}

// Mock database
class MockDB {
  public data: Map<string, any> = new Map()
  public collections: Map<string, any> = new Map()
  public fields: Map<string, any> = new Map()

  prepare(query: string) {
    return new MockPreparedStatement(query, this)
  }

  addCollection(tenantId: string, collection: any) {
    this.collections.set(`${tenantId}:${collection.id}`, collection)
  }

  addField(field: any) {
    this.fields.set(field.id, field)
  }

  clear() {
    this.data.clear()
    this.collections.clear()
    this.fields.clear()
  }
}

// Mock KV cache
class MockKV {
  private cache: Map<string, string> = new Map()

  async get(key: string) {
    return this.cache.get(key) || null
  }

  async put(key: string, value: string, options?: any) {
    this.cache.set(key, value)
  }

  async delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }
}

describe('Query Builder', () => {
  describe('buildWhereClause', () => {
    it('should build simple equality filters', () => {
      const { clause, params } = buildWhereClause({
        name: 'John',
        age: 30,
      })

      expect(clause).toContain('name = ?')
      expect(clause).toContain('age = ?')
      expect(params).toEqual(['John', 30])
    })

    it('should handle array filters (IN clause)', () => {
      const { clause, params } = buildWhereClause({
        status: ['active', 'pending'],
      })

      expect(clause).toContain('status IN (?, ?)')
      expect(params).toEqual(['active', 'pending'])
    })

    it('should handle advanced operators', () => {
      const { clause, params } = buildWhereClause({
        age: { gt: 18, lt: 65 },
        name: { like: 'John' },
      })

      expect(clause).toContain('age > ?')
      expect(clause).toContain('age < ?')
      expect(clause).toContain('name LIKE ?')
      expect(params).toEqual([18, 65, '%John%'])
    })

    it('should handle table aliases', () => {
      const { clause } = buildWhereClause({ name: 'John' }, 't')
      expect(clause).toContain('t.name = ?')
    })
  })

  describe('parseQueryParams', () => {
    it('should parse pagination params', () => {
      const options = parseQueryParams({
        page: '2',
        limit: '50',
      })

      expect(options.page).toBe(2)
      expect(options.limit).toBe(50)
    })

    it('should parse sorting params', () => {
      const options = parseQueryParams({
        sort: 'name,age',
        order: 'desc',
      })

      expect(options.sort).toEqual(['name', 'age'])
      expect(options.order).toBe('desc')
    })

    it('should parse field selection', () => {
      const options = parseQueryParams({
        select: 'id,name,email',
      })

      expect(options.select).toEqual(['id', 'name', 'email'])
    })

    it('should parse JSON filters', () => {
      const options = parseQueryParams({
        filter: JSON.stringify({ status: 'active', age: { gt: 18 } }),
      })

      expect(options.filters).toEqual({
        status: 'active',
        age: { gt: 18 },
      })
    })

    it('should fallback to simple filters when JSON is invalid', () => {
      const options = parseQueryParams({
        filter: 'invalid',
        status: 'active',
      })

      expect(options.filters).toEqual({ status: 'active' })
    })
  })

  describe('buildDataQuery', () => {
    it('should build complete query with all options', () => {
      const result = buildDataQuery('collection_data', {
        page: 1,
        limit: 20,
        filters: { tenant_id: 'tenant-123', collection_id: 'coll-456' },
        sort: 'created_at',
        order: 'desc',
        select: ['id', 'data'],
      })

      expect(result.sql).toContain('SELECT t.id, t.data')
      expect(result.sql).toContain('WHERE t.tenant_id = ? AND t.collection_id = ?')
      expect(result.sql).toContain('ORDER BY t.created_at DESC')
      expect(result.sql).toContain('LIMIT ? OFFSET ?')
      expect(result.params).toHaveLength(4) // 2 filters + limit + offset
      expect(result.countSql).toBeDefined()
    })
  })
})

describe('Data Validation', () => {
  describe('buildZodSchema', () => {
    it('should build schema for text fields', () => {
      const schema = buildZodSchema([
        {
          id: '1',
          name: 'title',
          type: 'text',
          required: true,
          unique: false,
        },
      ])

      const result = schema.safeParse({ title: 'Hello' })
      expect(result.success).toBe(true)

      const invalid = schema.safeParse({ title: 123 })
      expect(invalid.success).toBe(false)
    })

    it('should build schema for number fields', () => {
      const schema = buildZodSchema([
        {
          id: '1',
          name: 'age',
          type: 'number',
          required: true,
          unique: false,
        },
      ])

      const result = schema.safeParse({ age: 25 })
      expect(result.success).toBe(true)

      const invalid = schema.safeParse({ age: 'twenty-five' })
      expect(invalid.success).toBe(false)
    })

    it('should build schema for boolean fields', () => {
      const schema = buildZodSchema([
        {
          id: '1',
          name: 'active',
          type: 'boolean',
          required: true,
          unique: false,
        },
      ])

      const result = schema.safeParse({ active: true })
      expect(result.success).toBe(true)

      const invalid = schema.safeParse({ active: 'yes' })
      expect(invalid.success).toBe(false)
    })

    it('should handle optional fields', () => {
      const schema = buildZodSchema([
        {
          id: '1',
          name: 'description',
          type: 'text',
          required: false,
          unique: false,
        },
      ])

      const result = schema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should handle validation rules', () => {
      const schema = buildZodSchema([
        {
          id: '1',
          name: 'email',
          type: 'text',
          required: true,
          unique: false,
          validation: { email: true, min: 5, max: 100 },
        },
      ])

      const valid = schema.safeParse({ email: 'test@example.com' })
      expect(valid.success).toBe(true)

      const invalid = schema.safeParse({ email: 'not-an-email' })
      expect(invalid.success).toBe(false)
    })
  })
})

describe('Dynamic CRUD Routes', () => {
  let db: MockDB
  let kv: MockKV
  let app: Hono

  const tenantId = 'tenant-test-123'
  const userId = 'user-test-456'
  const collectionId = 'coll-test-789'

  beforeEach(() => {
    db = new MockDB()
    kv = new MockKV()

    // Add test collection
    db.addCollection(tenantId, {
      id: collectionId,
      tenant_id: tenantId,
      name: 'Test Collection',
      slug: 'test-collection',
    })

    // Add test fields
    db.addField({
      id: 'field-1',
      collection_id: collectionId,
      name: 'title',
      type: 'text',
      required: 1,
      unique: 0,
    })

    db.addField({
      id: 'field-2',
      collection_id: collectionId,
      name: 'count',
      type: 'number',
      required: 0,
      unique: 0,
    })

    // Setup app with proper environment binding
    app = new Hono<{
      Bindings: { DB: any; KV: any }
      Variables: { tenantId: string; userId: string }
    }>()
    app.use('*', async (c, next) => {
      c.set('tenantId', tenantId)
      c.set('userId', userId)
      ;(c as any).env = { DB: db, KV: kv }
      await next()
    })
    app.route('/data', dynamicCrudRoutes)

    // Global error handler - handles ApiError and other errors
    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          {
            error: err.code,
            message: err.message,
            details: err.details,
          },
          err.statusCode,
        )
      }

      // Zod validation errors
      if (err?.name === 'ZodError') {
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: err?.errors,
          },
          400,
        )
      }

      // Log and return internal error
      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
        500,
      )
    })
  })

  afterEach(() => {
    db.clear()
    kv.clear()
  })

  describe('POST /data/:schemaId', () => {
    it('should create a new record', async () => {
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Item', count: 42 }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBeDefined()
      expect(data.title).toBe('Test Item')
      expect(data.count).toBe(42)
    })

    it('should validate required fields', async () => {
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 42 }), // Missing required 'title'
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('INVALID_INPUT')
    })

    it('should reject invalid schema ID', async () => {
      const res = await app.request('/data/non-existent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /data/:schemaId', () => {
    beforeEach(async () => {
      // Create some test records
      for (let i = 1; i <= 5; i++) {
        await app.request('/data/' + collectionId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Item ${i}`, count: i * 10 }),
        })
      }
    })

    it('should list all records', async () => {
      const res = await app.request('/data/' + collectionId)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(5)
      expect(data.pagination.total).toBe(5)
    })

    it('should support pagination', async () => {
      const res = await app.request('/data/' + collectionId + '?page=1&limit=2')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(2)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(2)
      expect(data.pagination.totalPages).toBe(3)
    })

    it('should support filtering', async () => {
      const res = await app.request(
        '/data/' +
          collectionId +
          '?filter=' +
          encodeURIComponent(
            JSON.stringify({
              title: 'Item 1',
            }),
          ),
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].title).toBe('Item 1')
    })

    it('should support sorting', async () => {
      const res = await app.request('/data/' + collectionId + '?sort=count&order=desc')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data[0].count).toBe(50) // Highest first
    })
  })

  describe('GET /data/:schemaId/:id', () => {
    let recordId: string

    beforeEach(async () => {
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Single Item', count: 99 }),
      })
      const data = await res.json()
      recordId = data.id
    })

    it('should get a single record', async () => {
      const res = await app.request('/data/' + collectionId + '/' + recordId)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(recordId)
      expect(data.title).toBe('Single Item')
    })

    it('should return 404 for non-existent record', async () => {
      const res = await app.request('/data/' + collectionId + '/non-existent')
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /data/:schemaId/:id', () => {
    let recordId: string

    beforeEach(async () => {
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Original', count: 10 }),
      })
      const data = await res.json()
      recordId = data.id
    })

    it('should update a record', async () => {
      const res = await app.request('/data/' + collectionId + '/' + recordId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', count: 20 }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.title).toBe('Updated')
      expect(data.count).toBe(20)
    })

    it('should partially update a record', async () => {
      const res = await app.request('/data/' + collectionId + '/' + recordId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 30 }), // Only update count
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.title).toBe('Original') // Unchanged
      expect(data.count).toBe(30)
    })
  })

  describe('DELETE /data/:schemaId/:id', () => {
    let recordId: string

    beforeEach(async () => {
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'To Delete', count: 1 }),
      })
      const data = await res.json()
      recordId = data.id
    })

    it('should delete a record', async () => {
      const res = await app.request('/data/' + collectionId + '/' + recordId, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe('Record deleted successfully')

      // Verify it's gone
      const getRes = await app.request('/data/' + collectionId + '/' + recordId)
      expect(getRes.status).toBe(404)
    })
  })

  describe('POST /data/:schemaId/bulk', () => {
    it('should bulk create records', async () => {
      const res = await app.request('/data/' + collectionId + '/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { title: 'Bulk 1', count: 1 },
          { title: 'Bulk 2', count: 2 },
          { title: 'Bulk 3', count: 3 },
        ]),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.count).toBe(3)
      expect(data.data).toHaveLength(3)
      expect(data.data[0].title).toBe('Bulk 1')
    })

    it('should handle partial failures', async () => {
      const res = await app.request('/data/' + collectionId + '/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { title: 'Valid', count: 1 },
          { count: 2 }, // Missing required title
          { title: 'Also Valid', count: 3 },
        ]),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.count).toBe(2)
      expect(data.failedCount).toBe(1)
      expect(data.errors).toBeDefined()
    })
  })

  describe('Cache Mechanism', () => {
    it('should cache schema metadata', async () => {
      // First request - should populate cache
      await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      })

      // Check cache
      const cacheKey = `schema:metadata:${tenantId}:${collectionId}`
      const cached = await kv.get(cacheKey)
      expect(cached).toBeDefined()
      const parsed = JSON.parse(cached!)
      expect(parsed.id).toBe(collectionId)
    })

    it('should support cache warming', async () => {
      const res = await app.request('/data/' + collectionId + '/cache/warm', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.cached).toBe(true)
    })

    it('should support cache invalidation', async () => {
      // Populate cache
      await app.request('/data/' + collectionId + '/cache/warm', {
        method: 'POST',
      })

      // Invalidate
      const res = await app.request('/data/' + collectionId + '/cache', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)

      // Verify cache is cleared
      const cacheKey = `schema:metadata:${tenantId}:${collectionId}`
      const cached = await kv.get(cacheKey)
      expect(cached).toBeNull()
    })
  })

  describe('Tenant Isolation', () => {
    let otherTenantId: string
    let recordId: string

    beforeEach(async () => {
      otherTenantId = 'tenant-other-999'

      // Create record for first tenant
      const res = await app.request('/data/' + collectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Tenant 1 Item', count: 1 }),
      })
      const data = await res.json()
      recordId = data.id
    })

    it('should not allow access to other tenant data', async () => {
      // Create separate app for different tenant
      const otherApp = new Hono<{
        Bindings: { DB: any; KV: any }
        Variables: { tenantId: string; userId: string }
      }>()
      otherApp.use('*', async (c, next) => {
        c.set('tenantId', otherTenantId) // Different tenant
        c.set('userId', userId)
        ;(c as any).env = { DB: db, KV: kv }
        await next()
      })
      otherApp.route('/data', dynamicCrudRoutes)

      // Try to access record from different tenant
      const res = await otherApp.request('/data/' + collectionId + '/' + recordId)

      // Should not find the record (tenant isolation)
      expect(res.status).toBe(404)
    })

    it('should enforce tenant ID in queries', async () => {
      // All queries should include tenant_id filter
      // This is tested implicitly by tenant isolation test above
      const res = await app.request('/data/' + collectionId)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].title).toBe('Tenant 1 Item')
    })
  })
})

describe('Integration Tests', () => {
  it('should handle complete CRUD workflow', async () => {
    const db = new MockDB()
    const kv = new MockKV()
    const app = new Hono()

    const tenantId = 'tenant-integration'
    const userId = 'user-integration'
    const collectionId = 'coll-integration'

    db.addCollection(tenantId, {
      id: collectionId,
      tenant_id: tenantId,
      name: 'Integration Test',
      slug: 'integration-test',
    })

    db.addField({
      id: 'field-1',
      collection_id: collectionId,
      name: 'name',
      type: 'text',
      required: 1,
      unique: 0,
    })

    app.use('*', async (c, next) => {
      c.set('tenantId', tenantId)
      c.set('userId', userId)
      ;(c as any).env = { DB: db, KV: kv }
      await next()
    })
    app.route('/data', dynamicCrudRoutes)

    // CREATE
    const createRes = await app.request('/data/' + collectionId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Record' }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.name).toBe('Test Record')

    // READ
    const readRes = await app.request('/data/' + collectionId + '/' + created.id)
    expect(readRes.status).toBe(200)
    const record = await readRes.json()
    expect(record.name).toBe('Test Record')

    // UPDATE
    const updateRes = await app.request('/data/' + collectionId + '/' + created.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Record' }),
    })
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.name).toBe('Updated Record')

    // DELETE
    const deleteRes = await app.request('/data/' + collectionId + '/' + created.id, {
      method: 'DELETE',
    })
    expect(deleteRes.status).toBe(200)

    // Verify deletion
    const verifyRes = await app.request('/data/' + collectionId + '/' + created.id)
    expect(verifyRes.status).toBe(404)
  })
})
