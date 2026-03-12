/**
 * Database seed script
 * Creates sample data for development and testing
 */

import { hashPassword } from '../utils/password';

export async function seedDatabase(db: D1Database) {
  console.log('Seeding database...');

  // Create default tenant
  const tenantId = 'tenant-default-001';
  await db.prepare(`
    INSERT OR IGNORE INTO tenants (id, name, slug, email, plan, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(tenantId, 'Default Tenant', 'default', 'default@example.com', 'pro', 'active').run();
  console.log('✓ Created default tenant');

  // Create admin user
  const adminId = 'user-admin-001';
  const adminPassword = await hashPassword('admin123');
  await db.prepare(`
    INSERT OR IGNORE INTO users (id, tenant_id, email, password, name, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(adminId, tenantId, 'admin@example.com', adminPassword, 'Admin User', 'owner', 'active').run();
  console.log('✓ Created admin user (admin@example.com / admin123)');

  // Create sample user
  const userId = 'user-sample-001';
  const userPassword = await hashPassword('user123');
  await db.prepare(`
    INSERT OR IGNORE INTO users (id, tenant_id, email, password, name, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(userId, tenantId, 'user@example.com', userPassword, 'Sample User', 'editor', 'active').run();
  console.log('✓ Created sample user (user@example.com / user123)');

  // Create sample collection
  const collectionId = 'collection-articles-001';
  await db.prepare(`
    INSERT OR IGNORE INTO collections (id, tenant_id, name, slug, description, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(collectionId, tenantId, 'Articles', 'articles', 'Blog articles collection').run();
  console.log('✓ Created Articles collection');

  // Add fields to collection
  const fields = [
    { name: 'title', type: 'text', required: 1 },
    { name: 'content', type: 'text', required: 1 },
    { name: 'published', type: 'boolean', required: 0 },
    { name: 'author', type: 'text', required: 0 },
    { name: 'tags', type: 'json', required: 0 },
  ];

  for (const field of fields) {
    const fieldId = `field-${field.name}-001`;
    await db.prepare(`
      INSERT OR IGNORE INTO collection_fields (id, collection_id, name, type, required, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(fieldId, collectionId, field.name, field.type, field.required).run();
  }
  console.log('✓ Added fields to Articles collection');

  // Create sample data
  const sampleArticles = [
    {
      title: 'Getting Started with Geekron CMS',
      content: 'Welcome to Geekron CMS! This is your first article.',
      published: 1,
      author: 'Admin',
      tags: JSON.stringify(['guide', 'cms', 'getting-started']),
    },
    {
      title: 'Advanced Features',
      content: 'Learn about the advanced features of Geekron CMS.',
      published: 1,
      author: 'Admin',
      tags: JSON.stringify(['advanced', 'features']),
    },
    {
      title: 'Draft Article',
      content: 'This is a draft article that is not published yet.',
      published: 0,
      author: 'User',
      tags: JSON.stringify(['draft']),
    },
  ];

  for (const article of sampleArticles) {
    const dataId = `data-article-${crypto.randomUUID().split('-')[0]}`;
    await db.prepare(`
      INSERT OR IGNORE INTO collection_data (id, collection_id, tenant_id, data, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(dataId, collectionId, tenantId, JSON.stringify(article), adminId).run();
  }
  console.log('✓ Created sample articles');

  // Create sample API key
  const apiKeyId = 'apikey-sample-001';
  const apiKey = 'gk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
  const hashedKey = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  await db.prepare(`
    INSERT OR IGNORE INTO api_keys (id, tenant_id, name, key, permissions, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(apiKeyId, tenantId, 'Sample API Key', hashedKey, JSON.stringify(['read', 'write'])).run();
  console.log('✓ Created sample API key');
  console.log(`  API Key: ${apiKey} (save this, it won't be shown again!)`);

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\nSample credentials:');
  console.log('  Admin: admin@example.com / admin123');
  console.log('  User: user@example.com / user123');
  console.log(`  API Key: ${apiKey}`);
}

// CLI entry point
if (typeof Bun !== 'undefined') {
  console.log('Seed script loaded');
}
