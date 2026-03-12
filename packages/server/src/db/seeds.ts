/**
 * D1 种子数据脚本
 * 用于初始化测试数据
 */

interface SeedData {
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    email: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'suspended' | 'deleted';
    settings: string;
    created_at: string;
  }>;
  users: Array<{
    id: string;
    tenant_id: string;
    email: string;
    password: string;
    name: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    status: 'active' | 'inactive' | 'banned';
    created_at: string;
  }>;
  collections: Array<{
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    description: string;
    created_at: string;
  }>;
}

export const seedData: SeedData = {
  tenants: [
    {
      id: 'tenant-001',
      name: '演示租户',
      slug: 'demo',
      email: 'demo@geekron.com',
      plan: 'pro',
      status: 'active',
      settings: JSON.stringify({ theme: 'light', language: 'zh-CN' }),
      created_at: new Date().toISOString(),
    },
    {
      id: 'tenant-002',
      name: '测试公司',
      slug: 'test-corp',
      email: 'admin@testcorp.com',
      plan: 'enterprise',
      status: 'active',
      settings: JSON.stringify({ theme: 'dark', language: 'en-US' }),
      created_at: new Date().toISOString(),
    },
  ],

  users: [
    {
      id: 'user-001',
      tenant_id: 'tenant-001',
      email: 'admin@geekron.com',
      password: '$2b$10$example.hash.for.demo.password', // 实际应使用 bcrypt 加密
      name: '管理员',
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'user-002',
      tenant_id: 'tenant-001',
      email: 'editor@geekron.com',
      password: '$2b$10$example.hash.for.demo.password',
      name: '编辑员',
      role: 'editor',
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'user-003',
      tenant_id: 'tenant-002',
      email: 'admin@testcorp.com',
      password: '$2b$10$example.hash.for.demo.password',
      name: '测试管理员',
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ],

  collections: [
    {
      id: 'collection-001',
      tenant_id: 'tenant-001',
      name: '文章',
      slug: 'articles',
      description: '博客文章集合',
      created_at: new Date().toISOString(),
    },
    {
      id: 'collection-002',
      tenant_id: 'tenant-001',
      name: '产品',
      slug: 'products',
      description: '产品信息集合',
      created_at: new Date().toISOString(),
    },
    {
      id: 'collection-003',
      tenant_id: 'tenant-002',
      name: '客户',
      slug: 'customers',
      description: '客户信息集合',
      created_at: new Date().toISOString(),
    },
  ],
};

/**
 * 执行种子数据插入
 */
export async function runSeeds(db: D1Database): Promise<void> {
  console.log('Running seed data...\n');

  // 插入租户
  console.log('Inserting tenants...');
  for (const tenant of seedData.tenants) {
    await db
      .prepare(`
        INSERT OR REPLACE INTO tenants (id, name, slug, email, plan, status, settings, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        tenant.id,
        tenant.name,
        tenant.slug,
        tenant.email,
        tenant.plan,
        tenant.status,
        tenant.settings,
        tenant.created_at
      )
      .run();
  }
  console.log(`✓ Inserted ${seedData.tenants.length} tenants`);

  // 插入用户
  console.log('Inserting users...');
  for (const user of seedData.users) {
    await db
      .prepare(`
        INSERT OR REPLACE INTO users (id, tenant_id, email, password, name, role, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        user.id,
        user.tenant_id,
        user.email,
        user.password,
        user.name,
        user.role,
        user.status,
        user.created_at
      )
      .run();
  }
  console.log(`✓ Inserted ${seedData.users.length} users`);

  // 插入集合
  console.log('Inserting collections...');
  for (const collection of seedData.collections) {
    await db
      .prepare(`
        INSERT OR REPLACE INTO collections (id, tenant_id, name, slug, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        collection.id,
        collection.tenant_id,
        collection.name,
        collection.slug,
        collection.description,
        collection.created_at
      )
      .run();
  }
  console.log(`✓ Inserted ${seedData.collections.length} collections`);

  console.log('\nSeed data completed successfully!');
}

/**
 * 清空所有数据（用于重置）
 */
export async function clearSeeds(db: D1Database): Promise<void> {
  console.log('Clearing all data...');

  const tables = [
    'collection_data',
    'collection_fields',
    'collections',
    'api_keys',
    'audit_logs',
    'files',
    'users',
    'tenants',
  ];

  for (const table of tables) {
    await db.prepare(`DELETE FROM ${table}`).run();
    console.log(`✓ Cleared ${table}`);
  }

  console.log('All data cleared!');
}

// CLI 入口
if (typeof Bun !== 'undefined') {
  console.log('Seed script loaded');
}
