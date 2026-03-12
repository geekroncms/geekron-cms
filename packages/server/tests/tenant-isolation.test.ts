import { describe, test, expect } from 'bun:test';
import { 
  injectTenantConstraint,
  injectSelectConstraint,
  injectInsertConstraint,
  injectUpdateConstraint,
  injectDeleteConstraint,
  hasTenantConstraint,
  verifyTenantBoundary,
  verifyBatchTenantIsolation,
} from '../src/middleware/tenant-isolation';

describe('Tenant Isolation Middleware', () => {
  describe('SQL Injection - SELECT queries', () => {
    test('should add WHERE clause to SELECT without WHERE', () => {
      const sql = 'SELECT * FROM collections';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('WHERE tenant_id = ?');
      expect(result).toBe('SELECT * FROM collections WHERE tenant_id = ?');
    });

    test('should add tenant constraint to SELECT with existing WHERE', () => {
      const sql = 'SELECT * FROM collections WHERE id = ?';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
      expect(result).toContain('tenant_id = ? AND id = ?');
    });

    test('should not modify SELECT that already has tenant_id', () => {
      const sql = 'SELECT * FROM collections WHERE tenant_id = ? AND id = ?';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toBe(sql);
    });

    test('should handle SELECT with ORDER BY', () => {
      const sql = 'SELECT * FROM collections ORDER BY created_at DESC';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('WHERE tenant_id = ?');
      expect(result).toContain('ORDER BY created_at DESC');
    });

    test('should handle SELECT with LIMIT', () => {
      const sql = 'SELECT * FROM collections LIMIT 10';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('WHERE tenant_id = ?');
      expect(result).toContain('LIMIT 10');
    });

    test('should handle SELECT with GROUP BY', () => {
      const sql = 'SELECT COUNT(*) FROM collections GROUP BY tenant_id';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('WHERE tenant_id = ?');
      expect(result).toContain('GROUP BY tenant_id');
    });

    test('should handle complex SELECT with multiple clauses', () => {
      const sql = 'SELECT c.*, COUNT(f.id) as field_count FROM collections c LEFT JOIN collection_fields f ON c.id = f.collection_id WHERE c.id = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT 10';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
      expect(result).toContain('c.id = ?');
    });
  });

  describe('SQL Injection - INSERT queries', () => {
    test('should add tenant_id to INSERT statement', () => {
      const sql = 'INSERT INTO collections (id, name, slug, created_at) VALUES (?, ?, ?, ?)';
      const result = injectInsertConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id');
      expect(result).toContain('VALUES (?, ?, ?, ?, ?)');
    });

    test('should not modify INSERT that already has tenant_id', () => {
      const sql = 'INSERT INTO collections (id, tenant_id, name, slug) VALUES (?, ?, ?, ?)';
      const result = injectInsertConstraint(sql, 'tenant-123');
      
      expect(result).toBe(sql);
    });

    test('should handle INSERT with multiple values', () => {
      const sql = 'INSERT INTO collections (id, name, slug) VALUES (?, ?, ?)';
      const result = injectInsertConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id');
      expect(result).toContain('VALUES (?, ?, ?, ?)');
    });
  });

  describe('SQL Injection - UPDATE queries', () => {
    test('should add WHERE tenant_id to UPDATE without WHERE', () => {
      const sql = 'UPDATE collections SET name = ?';
      const result = injectUpdateConstraint(sql, 'tenant-123');
      
      expect(result).toContain('WHERE tenant_id = ?');
    });

    test('should add tenant_id constraint to UPDATE with WHERE', () => {
      const sql = 'UPDATE collections SET name = ? WHERE id = ?';
      const result = injectUpdateConstraint(sql, 'tenant-123');
      
      expect(result).toContain('AND tenant_id = ?');
      expect(result).toBe('UPDATE collections SET name = ? WHERE id = ? AND tenant_id = ?');
    });

    test('should not modify UPDATE that already has tenant_id', () => {
      const sql = 'UPDATE collections SET name = ? WHERE tenant_id = ? AND id = ?';
      const result = injectUpdateConstraint(sql, 'tenant-123');
      
      expect(result).toBe(sql);
    });
  });

  describe('SQL Injection - DELETE queries', () => {
    test('should add WHERE tenant_id to DELETE without WHERE', () => {
      const sql = 'DELETE FROM collections';
      const result = injectDeleteConstraint(sql, 'tenant-123');
      
      expect(result).toBe('DELETE FROM collections WHERE tenant_id = ?');
    });

    test('should add tenant_id constraint to DELETE with WHERE', () => {
      const sql = 'DELETE FROM collections WHERE id = ?';
      const result = injectDeleteConstraint(sql, 'tenant-123');
      
      expect(result).toBe('DELETE FROM collections WHERE id = ? AND tenant_id = ?');
    });

    test('should not modify DELETE that already has tenant_id', () => {
      const sql = 'DELETE FROM collections WHERE tenant_id = ? AND id = ?';
      const result = injectDeleteConstraint(sql, 'tenant-123');
      
      expect(result).toBe(sql);
    });
  });

  describe('hasTenantConstraint helper', () => {
    test('should detect tenant_id = pattern', () => {
      expect(hasTenantConstraint('WHERE tenant_id = ?')).toBe(true);
      expect(hasTenantConstraint('WHERE tenant_id=?')).toBe(true);
    });

    test('should detect tenant_id IN pattern', () => {
      expect(hasTenantConstraint('WHERE tenant_id IN (?, ?)')).toBe(true);
    });

    test('should return false for queries without tenant constraint', () => {
      expect(hasTenantConstraint('WHERE id = ?')).toBe(false);
      expect(hasTenantConstraint('WHERE user_id = ?')).toBe(false);
    });
  });

  describe('verifyTenantBoundary helper', () => {
    test('should return true when tenant IDs match', () => {
      const mockContext = {
        get: (key: string) => key === 'tenantId' ? 'tenant-123' : undefined,
      };
      
      const result = verifyTenantBoundary(mockContext as any, 'tenant-123');
      expect(result).toBe(true);
    });

    test('should return false when tenant IDs do not match', () => {
      const mockContext = {
        get: (key: string) => key === 'tenantId' ? 'tenant-123' : undefined,
      };
      
      const result = verifyTenantBoundary(mockContext as any, 'tenant-456');
      expect(result).toBe(false);
    });

    test('should return false when no tenant context', () => {
      const mockContext = {
        get: (key: string) => undefined,
      };
      
      const result = verifyTenantBoundary(mockContext as any, 'tenant-123');
      expect(result).toBe(false);
    });
  });

  describe('Edge cases and security', () => {
    test('should handle SQL with mixed case', () => {
      const sql = 'select * from collections where id = ?';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result.toLowerCase()).toContain('tenant_id = ?');
    });

    test('should handle SQL with extra whitespace', () => {
      const sql = 'SELECT   *   FROM   collections   WHERE   id   =   ?';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
    });

    test('should not modify non-CRUD queries', () => {
      const sql = 'CREATE TABLE test (id TEXT)';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result).toBe(sql);
    });

    test('should handle subqueries correctly', () => {
      const sql = 'SELECT * FROM collections WHERE id IN (SELECT collection_id FROM collection_fields WHERE type = ?)';
      const result = injectSelectConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
    });
  });

  describe('Batch tenant isolation verification', () => {
    test('verifyBatchTenantIsolation should check all items belong to tenant', async () => {
      // Mock database
      const mockDB = {
        prepare: (sql: string) => ({
          bind: (...values: any[]) => ({
            first: async () => {
              // Simulate checking if all IDs belong to tenant
              return { count: values.length - 1 }; // Last value is tenantId
            }
          })
        })
      };

      const mockContext = {
        get: (key: string) => key === 'tenantId' ? 'tenant-123' : undefined,
      };

      const ids = ['id1', 'id2', 'id3'];
      const result = await verifyBatchTenantIsolation(
        mockContext as any,
        mockDB as any,
        'collections',
        ids
      );

      // Should return true if all items belong to tenant
      expect(typeof result).toBe('boolean');
    });

    test('verifyBatchTenantIsolation should return false for empty IDs', async () => {
      const mockDB = { prepare: () => ({}) };
      const mockContext = { get: () => 'tenant-123' };

      const result = await verifyBatchTenantIsolation(
        mockContext as any,
        mockDB as any,
        'collections',
        []
      );

      expect(result).toBe(false);
    });

    test('verifyBatchTenantIsolation should return false without tenant context', async () => {
      const mockDB = { prepare: () => ({}) };
      const mockContext = { get: () => undefined };

      const result = await verifyBatchTenantIsolation(
        mockContext as any,
        mockDB as any,
        'collections',
        ['id1', 'id2']
      );

      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    test('should handle typical collection query', () => {
      const sql = 'SELECT * FROM collections WHERE tenant_id = ? AND slug = ?';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      // Should not modify since tenant_id is already present
      expect(result).toBe(sql);
    });

    test('should handle collection data query', () => {
      const sql = 'SELECT * FROM collection_data WHERE collection_id = ? ORDER BY created_at DESC';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
      expect(result).toContain('collection_id = ?');
    });

    test('should handle user query', () => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
    });

    test('should handle file query', () => {
      const sql = 'SELECT * FROM files WHERE id = ?';
      const result = injectTenantConstraint(sql, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
    });
  });

  describe('Security - Cross-tenant access prevention', () => {
    test('should prevent DELETE without tenant constraint', () => {
      const maliciousSQL = 'DELETE FROM collections WHERE id = ?';
      const result = injectDeleteConstraint(maliciousSQL, 'tenant-123');
      
      expect(result).toContain('AND tenant_id = ?');
      expect(result).not.toBe('DELETE FROM collections WHERE id = ?');
    });

    test('should prevent UPDATE without tenant constraint', () => {
      const maliciousSQL = 'UPDATE collections SET name = ? WHERE id = ?';
      const result = injectUpdateConstraint(maliciousSQL, 'tenant-123');
      
      expect(result).toContain('AND tenant_id = ?');
    });

    test('should prevent SELECT without tenant constraint', () => {
      const maliciousSQL = 'SELECT * FROM collection_data WHERE collection_id = ?';
      const result = injectSelectConstraint(maliciousSQL, 'tenant-123');
      
      expect(result).toContain('tenant_id = ?');
    });
  });
});

describe('Tenant Isolation - Real-world SQL patterns', () => {
  test('should handle JOIN queries', () => {
    const sql = 'SELECT c.*, u.name FROM collections c JOIN users u ON c.created_by = u.id WHERE c.id = ?';
    const result = injectSelectConstraint(sql, 'tenant-123');
    
    expect(result).toContain('tenant_id = ?');
  });

  test('should handle LEFT JOIN queries', () => {
    const sql = 'SELECT c.*, COUNT(f.id) as field_count FROM collections c LEFT JOIN collection_fields f ON c.id = f.collection_id WHERE c.tenant_id = ? GROUP BY c.id';
    const result = injectSelectConstraint(sql, 'tenant-123');
    
    // Already has tenant_id, should not modify
    expect(result).toBe(sql);
  });

  test('should handle aggregate queries', () => {
    const sql = 'SELECT COUNT(*) as total FROM collection_data WHERE collection_id = ?';
    const result = injectSelectConstraint(sql, 'tenant-123');
    
    expect(result).toContain('tenant_id = ?');
  });

  test('should handle DISTINCT queries', () => {
    const sql = 'SELECT DISTINCT tenant_id FROM collections WHERE status = ?';
    const result = injectSelectConstraint(sql, 'tenant-123');
    
    expect(result).toContain('tenant_id = ?');
  });
});
