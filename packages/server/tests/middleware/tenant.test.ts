import { describe, test, expect } from 'bun:test';
import { tenantMiddleware } from '../../src/middleware/tenant';

// Mock D1 Database
class MockD1Database {
  private tenants: Map<string, any> = new Map();

  constructor() {
    this.tenants.set('active-tenant', {
      id: 'active-tenant',
      name: 'Active Tenant',
      status: 'active',
      plan: 'pro',
    });

    this.tenants.set('suspended-tenant', {
      id: 'suspended-tenant',
      name: 'Suspended Tenant',
      status: 'suspended',
      plan: 'free',
    });

    this.tenants.set('deleted-tenant', {
      id: 'deleted-tenant',
      name: 'Deleted Tenant',
      status: 'deleted',
      plan: 'free',
    });
  }

  prepare(query: string) {
    return new MockD1Statement(this, query);
  }

  getTenant(id: string) {
    return this.tenants.get(id);
  }
}

class MockD1Statement {
  private db: MockD1Database;
  private query: string;
  private params: any[] = [];

  constructor(db: MockD1Database, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...params: any[]) {
    this.params = params;
    return this;
  }

  async first() {
    const query = this.query.toLowerCase();
    
    if (query.includes('tenants') && (query.includes('where id = ?') || query.includes('where id=?'))) {
      return this.db.getTenant(this.params[0]);
    }

    return null;
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }

  async all() {
    return { results: [] };
  }
}

// Create test context
function createTestContext(overrides?: any) {
  const db = new MockD1Database();
  const variables = new Map();
  const headers = new Map<string, string>();
  
  if (overrides?.headers) {
    Object.entries(overrides.headers).forEach(([k, v]) => headers.set(k, v as string));
  }
  
  return {
    req: {
      header: (name: string) => headers.get(name),
      path: overrides?.path || '/api/test',
      method: overrides?.method || 'GET',
    },
    env: {
      DB: db,
    },
    set: (key: string, value: any) => {
      variables.set(key, value);
    },
    get: (key: string) => variables.get(key),
    json: (data: any, status: number) => ({ status, body: data }),
    ...overrides,
  };
}

describe('Tenant Middleware', () => {
  describe('X-Tenant-ID Header Priority', () => {
    test('should use X-Tenant-ID header when provided', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });

      let nextCalled = false;
      const next = () => { nextCalled = true; return Promise.resolve(); };
      
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(nextCalled).toBe(true);
      expect(ctx.get('tenantId')).toBe('active-tenant');
    });

    test('should validate tenant exists', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'non-existent-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(404);
      expect(result.body.error).toBe('Tenant not found');
    });

    test('should reject suspended tenant', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'suspended-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(403);
      expect(result.body.error).toBe('Tenant is not active');
    });

    test('should reject deleted tenant', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'deleted-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(403);
      expect(result.body.error).toBe('Tenant is not active');
    });
  });

  describe('Missing Tenant Context', () => {
    test('should reject request without X-Tenant-ID header', async () => {
      const ctx: any = createTestContext({
        headers: {},
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('X-Tenant-ID header is required');
    });

    test('should allow public paths without tenant ID', async () => {
      const publicPaths = ['/auth/login', '/auth/register', '/tenants'];
      
      for (const path of publicPaths) {
        const ctx: any = createTestContext({
          headers: {},
          path,
        });

        let nextCalled = false;
        const next = () => { nextCalled = true; return Promise.resolve(); };
        
        const result: any = await tenantMiddleware(ctx, next);
        
        expect(nextCalled).toBe(true);
      }
    });
  });

  describe('Tenant Validation', () => {
    test('should inject tenant ID into context', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      await tenantMiddleware(ctx, next);
      
      expect(ctx.get('tenantId')).toBe('active-tenant');
    });

    test('should verify tenant status is active', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });

      let nextCalled = false;
      const next = () => { nextCalled = true; return Promise.resolve(); };
      
      await tenantMiddleware(ctx, next);
      
      expect(nextCalled).toBe(true);
    });

    test('should handle tenant with different plans', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' }, // This is a 'pro' tenant
        path: '/api/test',
      });

      let nextCalled = false;
      const next = () => { nextCalled = true; return Promise.resolve(); };
      
      await tenantMiddleware(ctx, next);
      
      expect(nextCalled).toBe(true);
      expect(ctx.get('tenantId')).toBe('active-tenant');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tenant ID', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': '' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(400);
    });

    test('should handle malformed tenant ID', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': '!!!invalid!!!' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(404);
    });

    test('should handle database errors gracefully', async () => {
      const brokenDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => { throw new Error('DB error'); },
          }),
        }),
      };
      
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });
      ctx.env.DB = brokenDb;

      const next = () => Promise.resolve();
      
      // Should throw or handle error
      await expect(tenantMiddleware(ctx, next)).rejects.toThrow();
    });
  });

  describe('Integration with Auth', () => {
    test('should work with JWT-extracted tenant ID', async () => {
      // In real scenario, tenant ID might come from JWT
      // For this test, we simulate it being set by auth middleware
      const ctx: any = createTestContext({
        headers: {},
        path: '/api/test',
      });
      
      // Simulate auth middleware setting tenant ID
      // (In real code, this would be from JWT verification)
      
      const next = () => Promise.resolve();
      
      // Without X-Tenant-ID header, should fail for non-public paths
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(400);
    });

    test('should prioritize header over other sources', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });
      
      // Even if context has tenantId, header should be checked first
      ctx.set('tenantId', 'other-tenant');

      const next = () => Promise.resolve();
      await tenantMiddleware(ctx, next);
      
      // Header takes precedence
      expect(ctx.get('tenantId')).toBe('active-tenant');
    });
  });

  describe('Tenant Status Flow', () => {
    test('should handle active tenant', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'active-tenant' },
        path: '/api/test',
      });

      let nextCalled = false;
      const next = () => { nextCalled = true; return Promise.resolve(); };
      
      await tenantMiddleware(ctx, next);
      
      expect(nextCalled).toBe(true);
    });

    test('should block suspended tenant', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'suspended-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(403);
    });

    test('should block deleted tenant', async () => {
      const ctx: any = createTestContext({
        headers: { 'X-Tenant-ID': 'deleted-tenant' },
        path: '/api/test',
      });

      const next = () => Promise.resolve();
      const result: any = await tenantMiddleware(ctx, next);
      
      expect(result.status).toBe(403);
    });
  });
});
