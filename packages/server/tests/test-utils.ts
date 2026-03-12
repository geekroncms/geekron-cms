/**
 * Test Utilities for Geekron CMS
 * 
 * Provides helper functions for:
 * - Authentication (JWT, API Key generation)
 * - Tenant context setup
 * - Mock database operations
 * - Test data factories
 */

import { jwtVerify, SignJWT } from 'jose';

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Generate a test JWT token
 */
export async function generateTestJWT(payload: {
  sub: string;
  email: string;
  role?: string;
  tenant_id?: string;
  permissions?: string[];
}): Promise<string> {
  const secret = new TextEncoder().encode('test-secret-key');
  
  return new SignJWT({
    email: payload.email,
    role: payload.role || 'user',
    tenant_id: payload.tenant_id,
    permissions: payload.permissions || ['read'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime('2h')
    .sign(secret);
}

/**
 * Generate a test API Key
 */
export function generateTestApiKey(tenantId: string): {
  key: string;
  hashedKey: string;
} {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  const key = `gk_test_${tenantId}_${uuid}`;
  const hashedKey = hashApiKeySync(key);
  return { key, hashedKey };
}

/**
 * Hash API Key synchronously for testing
 */
function hashApiKeySync(key: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  // Use Web Crypto API
  const hashBuffer = crypto.subtle.digest('SHA-256', data);
  // For sync testing, we'll use a simple hash
  // In real code, this would be async
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Create authentication headers for requests
 */
export function createAuthHeaders(options?: {
  jwt?: string;
  apiKey?: string;
  tenantId?: string;
  contentType?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (options?.contentType !== false) {
    headers['Content-Type'] = options?.contentType || 'application/json';
  }
  
  if (options?.jwt) {
    headers['Authorization'] = `Bearer ${options.jwt}`;
  }
  
  if (options?.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }
  
  if (options?.tenantId) {
    headers['X-Tenant-ID'] = options.tenantId;
  }
  
  return headers;
}

// ============================================================================
// Tenant Context Helpers
// ============================================================================

/**
 * Mock tenant data factory
 */
export function createMockTenant(overrides?: Partial<MockTenant>): MockTenant {
  return {
    id: overrides?.id || crypto.randomUUID(),
    name: overrides?.name || 'Test Tenant',
    subdomain: overrides?.subdomain || 'test-tenant',
    email: overrides?.email || 'test@example.com',
    plan: overrides?.plan || 'free',
    status: overrides?.status || 'active',
    settings: overrides?.settings || '{}',
    quota_api_calls: overrides?.quota_api_calls || 1000,
    quota_storage_mb: overrides?.quota_storage_mb || 100,
    quota_users: overrides?.quota_users || 5,
    usage_api_calls: overrides?.usage_api_calls || 0,
    usage_storage_mb: overrides?.usage_storage_mb || 0,
    usage_users: overrides?.usage_users || 0,
    ...overrides,
  };
}

export interface MockTenant {
  id: string;
  name: string;
  subdomain: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  settings: string;
  quota_api_calls: number;
  quota_storage_mb: number;
  quota_users: number;
  usage_api_calls: number;
  usage_storage_mb: number;
  usage_users: number;
}

// ============================================================================
// User Data Factory
// ============================================================================

/**
 * Mock user data factory
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: overrides?.id || crypto.randomUUID(),
    email: overrides?.email || `user-${crypto.randomUUID().slice(0, 8)}@example.com`,
    name: overrides?.name || 'Test User',
    password_hash: overrides?.password_hash || 'hashed_password',
    role: overrides?.role || 'user',
    tenant_id: overrides?.tenant_id || 'test-tenant-id',
    permissions: overrides?.permissions || ['read'],
    created_at: overrides?.created_at || new Date().toISOString(),
    ...overrides,
  };
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'user' | 'admin' | 'owner';
  tenant_id: string;
  permissions: string[];
  created_at: string;
}

// ============================================================================
// Mock Database
// ============================================================================

/**
 * Mock D1 Database for testing
 */
export class MockD1Database {
  private data: Map<string, any[]> = new Map();
  private singleRecords: Map<string, any> = new Map();

  prepare(query: string) {
    return new MockD1Statement(this, query);
  }

  setSingleRecord(key: string, record: any) {
    this.singleRecords.set(key, record);
  }

  getSingleRecord(key: string): any {
    return this.singleRecords.get(key);
  }

  setRecords(key: string, records: any[]) {
    this.data.set(key, records);
  }

  getRecords(key: string): any[] {
    return this.data.get(key) || [];
  }
}

/**
 * Mock D1 Statement for testing
 */
export class MockD1Statement {
  private db: MockD1Database;
  private query: string;
  private params: any[] = [];
  private mockFirstResult: any = null;
  private mockRunResult: any = { success: true };
  private mockAllResults: any[] = [];

  constructor(db: MockD1Database, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...params: any[]) {
    this.params = params;
    return this;
  }

  /**
   * Set mock result for first() call
   */
  setMockFirst(result: any) {
    this.mockFirstResult = result;
    return this;
  }

  /**
   * Set mock result for run() call
   */
  setMockRun(result: any) {
    this.mockRunResult = result;
    return this;
  }

  /**
   * Set mock results for all() call
   */
  setMockAll(results: any[]) {
    this.mockAllResults = results;
    return this;
  }

  async first() {
    if (this.mockFirstResult !== null) {
      return this.mockFirstResult;
    }
    
    // Check if there's a single record set
    const key = this.query + JSON.stringify(this.params);
    const record = this.db.getSingleRecord(key);
    if (record) {
      return record;
    }
    
    return null;
  }

  async run() {
    return this.mockRunResult;
  }

  async all() {
    if (this.mockAllResults.length > 0) {
      return { results: this.mockAllResults };
    }
    
    const key = this.query + JSON.stringify(this.params);
    const records = this.db.getRecords(key);
    return { results: records };
  }
}

// ============================================================================
// Test Environment Setup
// ============================================================================

/**
 * Create a mock environment for testing
 */
export function createMockEnv(options?: {
  db?: MockD1Database;
  jwtSecret?: string;
  kv?: any;
}): any {
  return {
    DB: options?.db || new MockD1Database(),
    BUCKET: null,
    JWT_SECRET: options?.jwtSecret || 'test-secret-key',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_KEY: 'test-key',
    KV: options?.kv || null,
  };
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Parse JSON response safely
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as any;
  }
}

/**
 * Expect response to be successful (2xx)
 */
export function expectSuccess(response: Response): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Expected success response, got ${response.status}`);
  }
}

/**
 * Expect response to have specific status
 */
export function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`Expected status ${expected}, got ${response.status}`);
  }
}

// ============================================================================
// Collection Data Factory
// ============================================================================

/**
 * Mock collection data factory
 */
export function createMockCollection(overrides?: Partial<MockCollection>): MockCollection {
  return {
    id: overrides?.id || crypto.randomUUID(),
    name: overrides?.name || 'Test Collection',
    description: overrides?.description || 'A test collection',
    tenant_id: overrides?.tenant_id || 'test-tenant-id',
    schema: overrides?.schema || {
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'text', required: false },
      ],
    },
    created_at: overrides?.created_at || new Date().toISOString(),
    updated_at: overrides?.updated_at || new Date().toISOString(),
    ...overrides,
  };
}

export interface MockCollection {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  schema: any;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// File Data Factory
// ============================================================================

/**
 * Mock file data factory
 */
export function createMockFile(overrides?: Partial<MockFile>): MockFile {
  return {
    id: overrides?.id || crypto.randomUUID(),
    name: overrides?.name || 'test-file.txt',
    mime_type: overrides?.mime_type || 'text/plain',
    size: overrides?.size || 1024,
    tenant_id: overrides?.tenant_id || 'test-tenant-id',
    uploaded_by: overrides?.uploaded_by || 'test-user-id',
    created_at: overrides?.created_at || new Date().toISOString(),
    ...overrides,
  };
}

export interface MockFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  tenant_id: string;
  uploaded_by: string;
  created_at: string;
}

// ============================================================================
// Quota Data Factory
// ============================================================================

/**
 * Mock quota data factory
 */
export function createMockQuotas(overrides?: Partial<MockQuotas>): MockQuotas {
  return {
    max_requests_per_minute: overrides?.max_requests_per_minute || 60,
    max_requests_per_day: overrides?.max_requests_per_day || 10000,
    max_storage_bytes: overrides?.max_storage_bytes || 104857600, // 100MB
    max_users: overrides?.max_users || 5,
    max_collections: overrides?.max_collections || 10,
    max_api_keys: overrides?.max_api_keys || 5,
    plan: overrides?.plan || 'free',
  };
}

export interface MockQuotas {
  max_requests_per_minute: number;
  max_requests_per_day: number;
  max_storage_bytes: number;
  max_users: number;
  max_collections: number;
  max_api_keys: number;
  plan: 'free' | 'pro' | 'enterprise';
}

/**
 * Mock usage data factory
 */
export function createMockUsage(overrides?: Partial<MockUsage>): MockUsage {
  return {
    requests_today: overrides?.requests_today || 0,
    requests_this_minute: overrides?.requests_this_minute || 0,
    storage_bytes: overrides?.storage_bytes || 0,
    users_count: overrides?.users_count || 0,
    collections_count: overrides?.collections_count || 0,
    api_keys_count: overrides?.api_keys_count || 0,
  };
}

export interface MockUsage {
  requests_today: number;
  requests_this_minute: number;
  storage_bytes: number;
  users_count: number;
  collections_count: number;
  api_keys_count: number;
}
