import { describe, expect, test } from 'bun:test'
import app from '../src/index'
import { generateTestJWT } from './test-utils'

// Mock D1 Database with better control
class TestD1Database {
  private tenants: Map<string, any> = new Map()
  private quotas: Map<string, any> = new Map()
  private usage: Map<string, any> = new Map()

  constructor() {
    // Pre-populate with test data
    this.tenants.set('existing-tenant-id', {
      id: 'existing-tenant-id',
      name: 'Existing Tenant',
      subdomain: 'existing',
      email: 'existing@example.com',
      plan: 'free',
      status: 'active',
      settings: '{}',
      quota_api_calls: 1000,
      quota_storage_mb: 100,
      quota_users: 5,
      usage_api_calls: 0,
      usage_storage_mb: 0,
      usage_users: 0,
    })

    this.tenants.set('suspended-tenant-id', {
      id: 'suspended-tenant-id',
      name: 'Suspended Tenant',
      subdomain: 'suspended',
      email: 'suspended@example.com',
      plan: 'free',
      status: 'suspended',
      settings: '{}',
    })

    this.tenants.set('deleted-tenant-id', {
      id: 'deleted-tenant-id',
      name: 'Deleted Tenant',
      subdomain: 'deleted',
      email: 'deleted@example.com',
      plan: 'free',
      status: 'deleted',
      settings: '{}',
    })

    // Setup quotas
    this.quotas.set('existing-tenant-id', {
      tenant_id: 'existing-tenant-id',
      max_requests_per_minute: 60,
      max_requests_per_day: 10000,
      max_storage_bytes: 104857600,
      max_users: 5,
      max_collections: 10,
      max_api_keys: 5,
      plan: 'free',
    })

    // Setup usage
    this.usage.set('existing-tenant-id', {
      tenant_id: 'existing-tenant-id',
      requests_today: 0,
      requests_this_minute: 0,
      storage_bytes: 0,
      users_count: 0,
      collections_count: 0,
      api_keys_count: 0,
    })
  }

  prepare(query: string) {
    return new TestD1Statement(this, query)
  }

  getTenant(id: string) {
    return this.tenants.get(id)
  }

  addTenant(tenant: any) {
    this.tenants.set(tenant.id, tenant)
  }
}

class TestD1Statement {
  private db: TestD1Database
  private query: string
  private params: any[] = []

  constructor(db: TestD1Database, query: string) {
    this.db = db
    this.query = query
  }

  bind(...params: any[]) {
    this.params = params
    return this
  }

  async first() {
    const query = this.query.toLowerCase()

    // Handle tenant queries
    if (query.includes('tenants')) {
      if (query.includes('where id = ?') || query.includes('where id=?')) {
        return this.db.getTenant(this.params[0])
      }
      if (query.includes('subdomain = ?') || query.includes('subdomain=?')) {
        const subdomain = this.params[0]
        if (subdomain === 'taken') {
          return { id: 'some-id', subdomain: 'taken' }
        }
        return null
      }
      if (query.includes('select count')) {
        return { count: this.db.tenants.size }
      }
      // Handle SELECT * FROM tenants WHERE id = ? (various formats)
      if (query.includes('select')) {
        // Try each param as potential tenant ID
        for (const param of this.params) {
          const tenant = this.db.getTenant(param)
          if (tenant) return tenant
        }
        return null
      }
    }

    // Handle quota queries
    if (query.includes('tenant_quotas')) {
      if (query.includes('where tenant_id = ?') || query.includes('where tenant_id=?')) {
        return this.db.quotas.get(this.params[0])
      }
      // Handle SELECT with tenant_id filter
      for (const param of this.params) {
        const quota = this.db.quotas.get(param)
        if (quota) return quota
      }
    }

    // Handle usage queries
    if (query.includes('tenant_usage')) {
      if (query.includes('where tenant_id = ?') || query.includes('where tenant_id=?')) {
        return this.db.usage.get(this.params[0])
      }
      // Handle SELECT with tenant_id filter
      for (const param of this.params) {
        const usage = this.db.usage.get(param)
        if (usage) return usage
      }
    }

    return null
  }

  async run() {
    const query = this.query.toLowerCase()

    // Handle INSERT into tenants
    if (query.includes('insert into tenants')) {
      // Create a new tenant with the provided data
      const newTenant = {
        id: this.params[0],
        name: this.params[1],
        subdomain: this.params[2],
        email: this.params[3],
        plan: this.params[4] || 'free',
        status: 'active',
        settings: this.params[5] || '{}',
      }
      this.db.addTenant(newTenant)

      // Initialize quotas
      const quotas = {
        tenant_id: newTenant.id,
        max_requests_per_minute:
          newTenant.plan === 'free' ? 60 : newTenant.plan === 'pro' ? 600 : 6000,
        max_requests_per_day:
          newTenant.plan === 'free' ? 1000 : newTenant.plan === 'pro' ? 10000 : 100000,
        max_storage_bytes:
          newTenant.plan === 'free'
            ? 1073741824
            : newTenant.plan === 'pro'
              ? 10737418240
              : 107374182400,
        max_users: newTenant.plan === 'free' ? 5 : newTenant.plan === 'pro' ? 50 : 500,
        max_collections: newTenant.plan === 'free' ? 10 : newTenant.plan === 'pro' ? 100 : 1000,
        max_api_keys: newTenant.plan === 'free' ? 5 : newTenant.plan === 'pro' ? 50 : 500,
        plan: newTenant.plan,
      }
      this.db.quotas.set(newTenant.id, quotas)

      // Initialize usage
      const usage = {
        tenant_id: newTenant.id,
        requests_today: 0,
        requests_this_minute: 0,
        storage_bytes: 0,
        users_count: 0,
        collections_count: 0,
        api_keys_count: 0,
      }
      this.db.usage.set(newTenant.id, usage)

      return { success: true, meta: { changes: 1, last_row_id: 1 } }
    }

    // Handle UPDATE tenants
    if (query.includes('update tenants')) {
      // Extract tenant ID from WHERE clause params (last param)
      const tenantId = this.params[this.params.length - 1]
      const tenant = this.db.getTenant(tenantId)
      if (tenant) {
        // Update tenant fields
        if (this.params[0]) tenant.name = this.params[0]
        if (this.params[1]) tenant.subdomain = this.params[1]
        if (this.params[2]) tenant.email = this.params[2]
        if (this.params[3]) tenant.plan = this.params[3]
        if (this.params[4]) tenant.status = this.params[4]
        if (this.params[5]) tenant.settings = this.params[5]
        this.db.addTenant(tenant)
      }
      return { success: true, meta: { changes: tenant ? 1 : 0 } }
    }

    // Handle INSERT into quotas
    if (query.includes('insert into tenant_quotas')) {
      return { success: true, meta: { changes: 1 } }
    }

    // Handle INSERT into usage
    if (query.includes('insert into tenant_usage')) {
      return { success: true, meta: { changes: 1 } }
    }

    return { success: true, meta: { changes: 1 } }
  }

  async all() {
    const query = this.query.toLowerCase()

    if (query.includes('select') && query.includes('tenants') && !query.includes('where')) {
      return { results: Array.from(this.db.tenants.values()) }
    }

    return { results: [] }
  }
}

// Mock environment
const mockEnv = {
  DB: new TestD1Database(),
  BUCKET: null,
  JWT_SECRET: 'test-secret-key',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_KEY: 'test-key',
  KV: null,
}

// Helper to create auth headers with JWT
async function createAuthHeaders(tenantId = 'existing-tenant-id') {
  const token = await generateTestJWT({
    sub: 'test-user',
    email: 'test@example.com',
    role: 'admin',
    tenant_id: tenantId,
    permissions: ['admin'],
  })

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  }
}

// Helper to make requests with proper environment
async function makeRequest(path: string, options: RequestInit = {}) {
  const db = new TestD1Database()
  const env = {
    DB: db,
    BUCKET: null,
    JWT_SECRET: 'test-secret-key',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_KEY: 'test-key',
    KV: null,
  }

  return app.request(path, options, env)
}

describe('Tenant Routes', () => {
  // ==================== POST /tenants (Create Tenant) ====================
  describe('POST /tenants', () => {
    test('should create a new tenant successfully', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'test-tenant',
          email: 'test@example.com',
          plan: 'free',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBeDefined()
      expect(data.name).toBe('Test Tenant')
      expect(data.subdomain).toBe('test-tenant')
      expect(data.status).toBe('active')
    })

    test('should reject invalid subdomain format', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'INVALID',
          email: 'test@example.com',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should reject subdomain shorter than 3 characters', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'ab',
          email: 'test@example.com',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should reject duplicate subdomain', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'taken',
          email: 'test@example.com',
        }),
      })

      expect(res.status).toBe(409)
    })

    test('should reject invalid email format', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'test-tenant',
          email: 'invalid-email',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should reject invalid plan', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Test Tenant',
          subdomain: 'test-tenant',
          email: 'test@example.com',
          plan: 'invalid',
        }),
      })

      expect(res.status).toBe(400)
    })

    test('should create tenant with pro plan quotas', async () => {
      const res = await makeRequest('/api/v1/tenants', {
        method: 'POST',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Pro Tenant',
          subdomain: 'pro-tenant',
          email: 'pro@example.com',
          plan: 'pro',
        }),
      })

      expect(res.status).toBe(201)
    })
  })

  // ==================== GET /tenants (List Tenants) ====================
  describe('GET /tenants', () => {
    test('should list tenants with pagination', async () => {
      const res = await makeRequest('/api/v1/tenants?page=1&limit=20', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toBeDefined()
      expect(data.pagination).toBeDefined()
    })

    test('should filter tenants by status', async () => {
      const res = await makeRequest('/api/v1/tenants?status=active', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
    })

    test('should filter tenants by plan', async () => {
      const res = await makeRequest('/api/v1/tenants?plan=pro', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
    })
  })

  // ==================== GET /tenants/:id (Get Tenant) ====================
  describe('GET /tenants/:id', () => {
    test('should get tenant details successfully', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'GET',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('existing-tenant-id')
      expect(data.name).toBe('Existing Tenant')
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })
  })

  // ==================== PATCH /tenants/:id (Update Tenant) ====================
  describe('PATCH /tenants/:id', () => {
    test('should update tenant name successfully', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'PATCH',
        headers: createAuthHeaders('existing-tenant-id'),
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      })

      expect(res.status).toBe(200)
    })

    test('should update tenant plan and quotas', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'PATCH',
        headers: createAuthHeaders('existing-tenant-id'),
        body: JSON.stringify({
          plan: 'enterprise',
        }),
      })

      expect(res.status).toBe(200)
    })

    test('should update tenant settings', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'PATCH',
        headers: createAuthHeaders('existing-tenant-id'),
        body: JSON.stringify({
          settings: { theme: 'dark', featureX: true },
        }),
      })

      expect(res.status).toBe(200)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id', {
        method: 'PATCH',
        headers: await createAuthHeaders(),
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      })

      expect(res.status).toBe(404)
    })

    test('should return message when no updates provided', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'PATCH',
        headers: createAuthHeaders('existing-tenant-id'),
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
    })
  })

  // ==================== DELETE /tenants/:id (Delete Tenant) ====================
  describe('DELETE /tenants/:id', () => {
    test('should soft delete tenant successfully', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'DELETE',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id', {
        method: 'DELETE',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })

    test('should return 400 for already deleted tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/deleted-tenant-id', {
        method: 'DELETE',
        headers: createAuthHeaders('deleted-tenant-id'),
      })

      expect(res.status).toBe(400)
    })
  })

  // ==================== POST /tenants/:id/activate (Activate Tenant) ====================
  describe('POST /tenants/:id/activate', () => {
    test('should activate suspended tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/suspended-tenant-id/activate', {
        method: 'POST',
        headers: createAuthHeaders('suspended-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return message if tenant already active', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id/activate', {
        method: 'POST',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return 400 for deleted tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/deleted-tenant-id/activate', {
        method: 'POST',
        headers: createAuthHeaders('deleted-tenant-id'),
      })

      expect(res.status).toBe(400)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id/activate', {
        method: 'POST',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })
  })

  // ==================== POST /tenants/:id/suspend (Suspend Tenant) ====================
  describe('POST /tenants/:id/suspend', () => {
    test('should suspend active tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id/suspend', {
        method: 'POST',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return message if tenant already suspended', async () => {
      const res = await makeRequest('/api/v1/tenants/suspended-tenant-id/suspend', {
        method: 'POST',
        headers: createAuthHeaders('suspended-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return 400 for deleted tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/deleted-tenant-id/suspend', {
        method: 'POST',
        headers: createAuthHeaders('deleted-tenant-id'),
      })

      expect(res.status).toBe(400)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id/suspend', {
        method: 'POST',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })
  })

  // ==================== GET /tenants/check-subdomain/:subdomain ====================
  describe('GET /tenants/check-subdomain/:subdomain', () => {
    test('should return available for valid subdomain', async () => {
      const res = await makeRequest('/api/v1/tenants/check-subdomain/available-subdomain', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(true)
      expect(data.available).toBe(true)
    })

    test('should return not available for taken subdomain', async () => {
      const res = await makeRequest('/api/v1/tenants/check-subdomain/taken', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(true)
      expect(data.available).toBe(false)
    })

    test('should return invalid for malformed subdomain', async () => {
      const res = await makeRequest('/api/v1/tenants/check-subdomain/INVALID', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(false)
      expect(data.available).toBe(false)
    })
  })

  // ==================== GET /tenants/:id/quotas (Get Quotas) ====================
  describe('GET /tenants/:id/quotas', () => {
    test('should get tenant quota usage', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id/quotas', {
        method: 'GET',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id/quotas', {
        method: 'GET',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })
  })

  // ==================== POST /tenants/:id/quotas/reset (Reset Quotas) ====================
  describe('POST /tenants/:id/quotas/reset', () => {
    test('should reset tenant quotas', async () => {
      const res = await makeRequest('/api/v1/tenants/existing-tenant-id/quotas/reset', {
        method: 'POST',
        headers: createAuthHeaders('existing-tenant-id'),
      })

      expect(res.status).toBe(200)
    })

    test('should return 404 for non-existent tenant', async () => {
      const res = await makeRequest('/api/v1/tenants/non-existent-id/quotas/reset', {
        method: 'POST',
        headers: await createAuthHeaders(),
      })

      expect(res.status).toBe(404)
    })
  })

  // ==================== Tenant Status Flow ====================
  describe('Tenant Status Flow', () => {
    test('should handle complete status flow: active -> suspended -> active -> deleted', async () => {
      // Suspend active tenant
      const suspendRes = await makeRequest('/api/v1/tenants/existing-tenant-id/suspend', {
        method: 'POST',
        headers: await createAuthHeaders('existing-tenant-id'),
      })
      expect(suspendRes.status).toBe(200)

      // Activate suspended tenant
      const activateRes = await makeRequest('/api/v1/tenants/existing-tenant-id/activate', {
        method: 'POST',
        headers: await createAuthHeaders('existing-tenant-id'),
      })
      expect(activateRes.status).toBe(200)

      // Delete tenant
      const deleteRes = await makeRequest('/api/v1/tenants/existing-tenant-id', {
        method: 'DELETE',
        headers: await createAuthHeaders('existing-tenant-id'),
      })
      expect(deleteRes.status).toBe(200)
    })
  })
})
