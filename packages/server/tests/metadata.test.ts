import { describe, test, expect, beforeEach } from 'bun:test';
import app from '../src/index';
import { generateTestJWT, createMockTenant, MockD1Database } from './test-utils';

// Mock D1 Database for metadata tests
class MetadataMockD1Database {
  private schemas: Map<string, any> = new Map();
  private fields: Map<string, any> = new Map();
  private versions: Map<string, any> = new Map();

  prepare(query: string) {
    return new MockD1Statement(query, this);
  }

  addSchema(schema: any) {
    this.schemas.set(schema.id, {
      ...schema,
      schema_json: typeof schema.schema_json === 'string' 
        ? schema.schema_json 
        : JSON.stringify(schema.schema_json),
    });
  }

  addField(field: any) {
    this.fields.set(field.id, {
      ...field,
      field_config: typeof field.field_config === 'string'
        ? field.field_config
        : JSON.stringify(field.field_config || {}),
    });
  }

  getSchemas() {
    return Array.from(this.schemas.values());
  }

  getFields() {
    return Array.from(this.fields.values());
  }

  getVersions() {
    return Array.from(this.versions.values());
  }
}

class MockD1Statement {
  private query: string;
  private db: MetadataMockD1Database;
  private params: any[] = [];

  constructor(query: string, db: MetadataMockD1Database) {
    this.query = query;
    this.db = db;
  }

  bind(...params: any[]) {
    this.params = params;
    return this;
  }

  async first() {
    // Handle different query types
    if (this.query.includes('metadata_schemas') && this.query.includes('SELECT')) {
      const schemaId = this.params[0];
      const schema = Array.from(this.db.getSchemas()).find(s => s.id === schemaId);
      return schema || null;
    }

    if (this.query.includes('metadata_fields') && this.query.includes('SELECT')) {
      const fieldId = this.params[0];
      const field = Array.from(this.db.getFields()).find(f => f.id === fieldId);
      return field || null;
    }

    return null;
  }

  async all() {
    if (this.query.includes('metadata_schemas')) {
      const schemas = this.db.getSchemas();
      return { results: schemas };
    }

    if (this.query.includes('metadata_fields')) {
      const fields = this.db.getFields();
      return { results: fields };
    }

    return { results: [] };
  }

  async run() {
    // Handle INSERT
    if (this.query.includes('INSERT INTO metadata_schemas')) {
      const [id, tenant_id, name, version, schema_json, status] = this.params;
      this.db.addSchema({
        id,
        tenant_id,
        name,
        version,
        schema_json,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { success: true, changes: 1 };
    }

    if (this.query.includes('INSERT INTO metadata_fields')) {
      const [id, schema_id, field_name, field_type, field_config] = this.params;
      this.db.addField({
        id,
        schema_id,
        field_name,
        field_type,
        field_config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { success: true, changes: 1 };
    }

    // Handle UPDATE
    if (this.query.includes('UPDATE metadata_schemas')) {
      return { success: true, changes: 1 };
    }

    if (this.query.includes('UPDATE metadata_fields')) {
      return { success: true, changes: 1 };
    }

    // Handle DELETE
    if (this.query.includes('DELETE FROM metadata_schemas')) {
      const schemaId = this.params[0];
      const schemas = this.db.getSchemas();
      const schema = schemas.find(s => s.id === schemaId);
      if (schema) {
        return { success: true, changes: 1 };
      }
      return { success: true, changes: 0 };
    }

    if (this.query.includes('DELETE FROM metadata_fields')) {
      const fieldId = this.params[0];
      const fields = this.db.getFields();
      const field = fields.find(f => f.id === fieldId);
      if (field) {
        return { success: true, changes: 1 };
      }
      return { success: true, changes: 0 };
    }

    return { success: true, changes: 0 };
  }
}

// Test helpers
async function createTestSchema(db: MetadataMockD1Database, tenantId: string, overrides?: any) {
  const schema = {
    id: `schema_${crypto.randomUUID().replace(/-/g, '')}`,
    tenant_id: tenantId,
    name: overrides?.name || 'TestSchema',
    version: overrides?.version || '1.0.0',
    schema_json: overrides?.schema_json || {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
    },
    status: overrides?.status || 'draft',
    created_by: 'test-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.addSchema(schema);
  return schema;
}

async function createTestField(db: MetadataMockD1Database, schemaId: string, overrides?: any) {
  const field = {
    id: `field_${crypto.randomUUID().replace(/-/g, '')}`,
    schema_id: schemaId,
    field_name: overrides?.field_name || 'test_field',
    field_type: overrides?.field_type || 'text',
    field_config: overrides?.field_config || {},
    is_required: overrides?.is_required ? 1 : 0,
    is_unique: overrides?.is_unique ? 1 : 0,
    default_value: overrides?.default_value || null,
    display_order: overrides?.display_order || 0,
    description: overrides?.description || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.addField(field);
  return field;
}

describe('Metadata API - Schema Management', () => {
  let mockDb: MetadataMockD1Database;
  let authToken: string;
  const tenantId = 'test-tenant-metadata-001';

  beforeEach(async () => {
    mockDb = new MetadataMockD1Database();
    
    // Generate auth token
    authToken = await generateTestJWT({
      sub: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenant_id: tenantId,
    });
  });

  describe('POST /metadata/schemas - Create Schema', () => {
    test('should create a new schema successfully', async () => {
      const schemaData = {
        name: 'Article',
        version: '1.0.0',
        schema_json: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
          },
        },
        status: 'draft',
      };

      const response = await app.request('/metadata/schemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(schemaData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Article');
      expect(data.version).toBe('1.0.0');
      expect(data.status).toBe('draft');
    });

    test('should reject invalid schema format', async () => {
      const invalidSchema = {
        name: 'InvalidSchema',
        version: '1.0.0',
        schema_json: 'not-an-object', // Invalid: should be object
      };

      const response = await app.request('/metadata/schemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(invalidSchema),
      });

      expect(response.status).toBe(400);
    });

    test('should reject duplicate schema name', async () => {
      // Create first schema
      await createTestSchema(mockDb, tenantId, { name: 'DuplicateTest' });

      const schemaData = {
        name: 'DuplicateTest',
        version: '1.0.0',
        schema_json: { type: 'object' },
      };

      const response = await app.request('/metadata/schemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(schemaData),
      });

      expect(response.status).toBe(409);
    });

    test('should enforce tenant isolation', async () => {
      const otherTenantId = 'other-tenant-001';
      await createTestSchema(mockDb, otherTenantId, { name: 'OtherTenantSchema' });

      const schemaData = {
        name: 'OtherTenantSchema', // Same name but different tenant
        version: '1.0.0',
        schema_json: { type: 'object' },
      };

      const response = await app.request('/metadata/schemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(schemaData),
      });

      expect(response.status).toBe(201); // Should succeed - different tenant
    });
  });

  describe('GET /metadata/schemas - List Schemas', () => {
    test('should return paginated list of schemas', async () => {
      // Create test data
      await createTestSchema(mockDb, tenantId, { name: 'Schema1' });
      await createTestSchema(mockDb, tenantId, { name: 'Schema2' });
      await createTestSchema(mockDb, tenantId, { name: 'Schema3' });

      const response = await app.request('/metadata/schemas?page=1&limit=2', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
    });

    test('should filter by status', async () => {
      await createTestSchema(mockDb, tenantId, { name: 'ActiveSchema', status: 'active' });
      await createTestSchema(mockDb, tenantId, { name: 'DraftSchema', status: 'draft' });

      const response = await app.request('/metadata/schemas?status=active', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      data.data.forEach((schema: any) => {
        expect(schema.status).toBe('active');
      });
    });

    test('should search by name', async () => {
      await createTestSchema(mockDb, tenantId, { name: 'Article' });
      await createTestSchema(mockDb, tenantId, { name: 'Blog' });

      const response = await app.request('/metadata/schemas?search=Article', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      data.data.forEach((schema: any) => {
        expect(schema.name.toLowerCase()).toContain('article');
      });
    });
  });

  describe('GET /metadata/schemas/:id - Get Schema Details', () => {
    test('should return schema with fields and versions', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      await createTestField(mockDb, schema.id, { field_name: 'title', is_required: true });
      await createTestField(mockDb, schema.id, { field_name: 'content' });

      const response = await app.request(`/metadata/schemas/${schema.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(schema.id);
      expect(data.fields).toBeDefined();
      expect(data.fields.length).toBe(2);
    });

    test('should return 404 for non-existent schema', async () => {
      const response = await app.request('/metadata/schemas/non-existent-id', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(404);
    });

    test('should enforce tenant isolation on read', async () => {
      const otherTenantId = 'other-tenant-002';
      const otherSchema = await createTestSchema(mockDb, otherTenantId);

      const response = await app.request(`/metadata/schemas/${otherSchema.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(404); // Should not find schema from other tenant
    });
  });

  describe('PATCH /metadata/schemas/:id - Update Schema', () => {
    test('should update schema successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId);

      const updateData = {
        name: 'UpdatedArticle',
        version: '1.1.0',
      };

      const response = await app.request(`/metadata/schemas/${schema.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Schema updated successfully');
    });

    test('should reject update with no changes', async () => {
      const schema = await createTestSchema(mockDb, tenantId);

      const response = await app.request(`/metadata/schemas/${schema.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('No updates provided');
    });
  });

  describe('DELETE /metadata/schemas/:id - Delete Schema', () => {
    test('should delete schema successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId);

      const response = await app.request(`/metadata/schemas/${schema.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Schema deleted successfully');
    });

    test('should return 404 for non-existent schema', async () => {
      const response = await app.request('/metadata/schemas/non-existent-id', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /metadata/schemas/:id/publish - Publish Schema', () => {
    test('should publish draft schema successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId, { status: 'draft' });
      await createTestField(mockDb, schema.id);

      const response = await app.request(`/metadata/schemas/${schema.id}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Schema published successfully');
      expect(data.status).toBe('active');
    });

    test('should reject publishing schema without fields', async () => {
      const schema = await createTestSchema(mockDb, tenantId, { status: 'draft' });

      const response = await app.request(`/metadata/schemas/${schema.id}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(400);
    });

    test('should return success for already published schema', async () => {
      const schema = await createTestSchema(mockDb, tenantId, { status: 'active' });

      const response = await app.request(`/metadata/schemas/${schema.id}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Schema is already published');
    });
  });
});

describe('Metadata API - Field Management', () => {
  let mockDb: MetadataMockD1Database;
  let authToken: string;
  const tenantId = 'test-tenant-fields-001';

  beforeEach(async () => {
    mockDb = new MetadataMockD1Database();
    
    authToken = await generateTestJWT({
      sub: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenant_id: tenantId,
    });
  });

  describe('POST /metadata/schemas/:id/fields - Create Field', () => {
    test('should create field successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId);

      const fieldData = {
        field_name: 'title',
        field_type: 'text',
        field_config: { maxLength: 200 },
        is_required: true,
        display_order: 1,
        description: 'Article title',
      };

      const response = await app.request(`/metadata/schemas/${schema.id}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(fieldData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.field_name).toBe('title');
      expect(data.field_type).toBe('text');
    });

    test('should reject invalid field name format', async () => {
      const schema = await createTestSchema(mockDb, tenantId);

      const fieldData = {
        field_name: '123-invalid', // Must start with letter or underscore
        field_type: 'text',
      };

      const response = await app.request(`/metadata/schemas/${schema.id}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(fieldData),
      });

      expect(response.status).toBe(400);
    });

    test('should reject duplicate field name in same schema', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      await createTestField(mockDb, schema.id, { field_name: 'title' });

      const fieldData = {
        field_name: 'title',
        field_type: 'text',
      };

      const response = await app.request(`/metadata/schemas/${schema.id}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(fieldData),
      });

      expect(response.status).toBe(409);
    });

    test('should support all field types', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      const fieldTypes = ['text', 'number', 'boolean', 'date', 'json', 'relation', 'email', 'url', 'phone'];

      for (const fieldType of fieldTypes) {
        const fieldData = {
          field_name: `field_${fieldType}`,
          field_type: fieldType,
        };

        const response = await app.request(`/metadata/schemas/${schema.id}/fields`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Tenant-ID': tenantId,
          },
          body: JSON.stringify(fieldData),
        });

        expect(response.status).toBe(201);
      }
    });
  });

  describe('GET /metadata/schemas/:id/fields - List Fields', () => {
    test('should return fields ordered by display_order', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      await createTestField(mockDb, schema.id, { field_name: 'third', display_order: 3 });
      await createTestField(mockDb, schema.id, { field_name: 'first', display_order: 1 });
      await createTestField(mockDb, schema.id, { field_name: 'second', display_order: 2 });

      const response = await app.request(`/metadata/schemas/${schema.id}/fields`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.length).toBe(3);
      expect(data.data[0].field_name).toBe('first');
      expect(data.data[1].field_name).toBe('second');
      expect(data.data[2].field_name).toBe('third');
    });
  });

  describe('PATCH /metadata/fields/:fieldId - Update Field', () => {
    test('should update field successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      const field = await createTestField(mockDb, schema.id, { field_name: 'old_name' });

      const updateData = {
        field_name: 'new_name',
        display_order: 10,
        is_required: true,
      };

      const response = await app.request(`/metadata/fields/${field.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Field updated successfully');
    });

    test('should return 404 for non-existent field', async () => {
      const response = await app.request('/metadata/fields/non-existent-field', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ field_name: 'test' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /metadata/fields/:fieldId - Delete Field', () => {
    test('should delete field successfully', async () => {
      const schema = await createTestSchema(mockDb, tenantId);
      const field = await createTestField(mockDb, schema.id);

      const response = await app.request(`/metadata/fields/${field.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Field deleted successfully');
    });

    test('should return 404 for non-existent field', async () => {
      const response = await app.request('/metadata/fields/non-existent-field', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      expect(response.status).toBe(404);
    });
  });
});

describe('Metadata API - Schema Validation', () => {
  let authToken: string;
  const tenantId = 'test-tenant-validation-001';

  beforeEach(async () => {
    authToken = await generateTestJWT({
      sub: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      tenant_id: tenantId,
    });
  });

  describe('POST /metadata/validate - Validate Schema', () => {
    test('should validate correct JSON Schema', async () => {
      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const response = await app.request('/metadata/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ schema_json: validSchema }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
    });

    test('should reject invalid schema format', async () => {
      const invalidSchema = 'not-an-object';

      const response = await app.request('/metadata/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ schema_json: invalidSchema }),
      });

      expect(response.status).toBe(400);
    });

    test('should reject schema without type or properties', async () => {
      const invalidSchema = { description: 'No type or properties' };

      const response = await app.request('/metadata/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ schema_json: invalidSchema }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});

describe('Metadata API - Tenant Isolation', () => {
  let mockDb: MetadataMockD1Database;
  let tenant1Token: string;
  let tenant2Token: string;
  const tenant1Id = 'tenant-isolation-001';
  const tenant2Id = 'tenant-isolation-002';

  beforeEach(async () => {
    mockDb = new MetadataMockD1Database();

    tenant1Token = await generateTestJWT({
      sub: 'user1',
      email: 'user1@example.com',
      role: 'admin',
      tenant_id: tenant1Id,
    });

    tenant2Token = await generateTestJWT({
      sub: 'user2',
      email: 'user2@example.com',
      role: 'admin',
      tenant_id: tenant2Id,
    });
  });

  test('should isolate schemas between tenants', async () => {
    // Tenant 1 creates schema
    const schema1Data = {
      name: 'Tenant1Schema',
      version: '1.0.0',
      schema_json: { type: 'object' },
    };

    const response1 = await app.request('/metadata/schemas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenant1Token}`,
        'X-Tenant-ID': tenant1Id,
      },
      body: JSON.stringify(schema1Data),
    });

    expect(response1.status).toBe(201);
    const schema1 = await response1.json();

    // Tenant 2 should not see Tenant 1's schema
    const listResponse = await app.request('/metadata/schemas', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tenant2Token}`,
        'X-Tenant-ID': tenant2Id,
      },
    });

    expect(listResponse.status).toBe(200);
    const listData = await listResponse.json();
    expect(listData.data.length).toBe(0);

    // Tenant 2 creates schema with same name
    const schema2Data = {
      name: 'Tenant1Schema', // Same name
      version: '1.0.0',
      schema_json: { type: 'object' },
    };

    const response2 = await app.request('/metadata/schemas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenant2Token}`,
        'X-Tenant-ID': tenant2Id,
      },
      body: JSON.stringify(schema2Data),
    });

    expect(response2.status).toBe(201); // Should succeed - different tenant
  });

  test('should prevent cross-tenant field access', async () => {
    // Tenant 1 creates schema and field
    const schema = await createTestSchema(mockDb, tenant1Id);
    const field = await createTestField(mockDb, schema.id);

    // Tenant 2 tries to access Tenant 1's field
    const response = await app.request(`/metadata/fields/${field.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenant2Token}`,
        'X-Tenant-ID': tenant2Id,
      },
      body: JSON.stringify({ field_name: 'hacked' }),
    });

    expect(response.status).toBe(404); // Should not find field
  });
});
