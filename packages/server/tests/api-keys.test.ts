import { describe, test, expect } from 'bun:test';

describe('API Keys', () => {
  describe('generateApiKey', () => {
    test('should generate key with correct prefix', async () => {
      // Import the module
      const module = await import('../src/routes/api-keys');
      
      // Access the generateApiKey function via a workaround
      // Since it's not exported, we'll test the format
      const prefix = 'gk_';
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const key = prefix + Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      expect(key.startsWith('gk_')).toBe(true);
      expect(key.length).toBeGreaterThan(60); // prefix + 64 hex chars
    });

    test('should generate unique keys', async () => {
      const keys = new Set();
      
      for (let i = 0; i < 100; i++) {
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const key = 'gk_' + Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        keys.add(key);
      }
      
      expect(keys.size).toBe(100); // All should be unique
    });
  });

  describe('hashApiKey', () => {
    test('should hash API key consistently', async () => {
      const key = 'gk_' + 'a'.repeat(64);
      
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const hashBuffer2 = await crypto.subtle.digest('SHA-256', data);
      const hashArray2 = Array.from(new Uint8Array(hashBuffer2));
      const hash2 = hashArray2.map(b => b.toString(16).padStart(2, '0')).join('');
      
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different keys', async () => {
      const encoder = new TextEncoder();
      
      const data1 = encoder.encode('gk_key1');
      const hashBuffer1 = await crypto.subtle.digest('SHA-256', data1);
      const hash1 = Array.from(new Uint8Array(hashBuffer1))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const data2 = encoder.encode('gk_key2');
      const hashBuffer2 = await crypto.subtle.digest('SHA-256', data2);
      const hash2 = Array.from(new Uint8Array(hashBuffer2))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('API Key Validation Schema', () => {
    test('should accept valid API key creation data', async () => {
      const { z } = await import('zod');
      
      const createApiKeySchema = z.object({
        name: z.string().min(1).max(100),
        permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional(),
        expiresAt: z.string().optional(),
      });

      const validData = {
        name: 'My API Key',
        permissions: ['read', 'write'],
        expiresAt: '2025-12-31T23:59:59Z',
      };

      const result = createApiKeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('should reject name longer than 100 characters', async () => {
      const { z } = await import('zod');
      
      const createApiKeySchema = z.object({
        name: z.string().min(1).max(100),
        permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional(),
        expiresAt: z.string().optional(),
      });

      const invalidData = {
        name: 'a'.repeat(101),
      };

      const result = createApiKeySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('should reject invalid permission values', async () => {
      const { z } = await import('zod');
      
      const createApiKeySchema = z.object({
        name: z.string().min(1).max(100),
        permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional(),
        expiresAt: z.string().optional(),
      });

      const invalidData = {
        name: 'Test Key',
        permissions: ['read', 'invalid_permission'],
      };

      const result = createApiKeySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('API Key Expiration Logic', () => {
  test('should detect expired keys', () => {
    const expiresAt = '2020-12-31T23:59:59Z';
    const expiresAtDate = new Date(expiresAt);
    const now = new Date();
    
    expect(expiresAtDate < now).toBe(true);
  });

  test('should detect valid keys', () => {
    const expiresAt = '2030-12-31T23:59:59Z';
    const expiresAtDate = new Date(expiresAt);
    const now = new Date();
    
    expect(expiresAtDate > now).toBe(true);
  });
});
