import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { hashPassword, comparePassword } from '../utils/password';
import { errors } from '../utils/errors';

export const userRoutes = new Hono();

// ==================== Schema Definitions ====================

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).default('viewer'),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).default('viewer'),
  permissions: z.array(z.string()).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// ==================== User Management Routes (Tenant-scoped) ====================

/**
 * GET /users
 * List all users in current tenant
 */
userRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const users: any = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.status, tm.role as tenant_role, 
           u.created_at, u.updated_at
    FROM users u
    INNER JOIN tenant_members tm ON u.id = tm.user_id
    WHERE tm.tenant_id = ?
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(tenantId, limit, offset).all();

  const total: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM users u
    INNER JOIN tenant_members tm ON u.id = tm.user_id
    WHERE tm.tenant_id = ?
  `).bind(tenantId).first();

  return c.json({
    data: users.results || [],
    pagination: {
      page,
      limit,
      total: total?.count || 0,
      totalPages: Math.ceil((total?.count || 0) / limit),
    },
  });
});

/**
 * GET /users/:id
 * Get user by ID (within current tenant)
 */
userRoutes.get('/:id', async (c) => {
  const userId = c.req.param('id');
  const tenantId = c.get('tenantId');
  
  const user: any = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.status, u.created_at, u.updated_at,
           tm.role as tenant_role, tm.permissions, tm.status as membership_status
    FROM users u
    INNER JOIN tenant_members tm ON u.id = tm.user_id
    WHERE u.id = ? AND tm.tenant_id = ?
  `).bind(userId, tenantId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  return c.json(user);
});

/**
 * POST /users
 * Create a new user and add to current tenant
 */
userRoutes.post('/', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json');
  const tenantId = c.get('tenantId');
  const db = c.env.DB;

  const existing: any = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(body.email).first();

  if (existing) {
    throw errors.conflict('Email already exists');
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(body.password);
  const now = new Date().toISOString();

  // Create user
  await db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(userId, body.email, hashedPassword, body.name, body.role, now, now).run();

  // Add user to tenant
  await db.prepare(`
    INSERT INTO tenant_members (id, tenant_id, user_id, role, permissions, created_at)
    VALUES (?, ?, ?, ?, null, ?)
  `).bind(crypto.randomUUID(), tenantId, userId, body.role, now).run();

  return c.json({
    id: userId,
    email: body.email,
    name: body.name,
    role: body.role,
    message: 'User created and added to tenant successfully',
  }, 201);
});

/**
 * POST /users/invite
 * Invite an existing user to current tenant
 */
userRoutes.post('/invite', zValidator('json', inviteUserSchema), async (c) => {
  const { email, role, permissions } = c.req.valid('json');
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const db = c.env.DB;

  // Find existing user
  const user: any = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    throw errors.notFound('User not found. Please create the user first.');
  }

  // Check if already a member
  const existing: any = await db.prepare(`
    SELECT id FROM tenant_members WHERE user_id = ? AND tenant_id = ?
  `).bind(user.id, tenantId).first();

  if (existing) {
    throw errors.conflict('User is already a member of this tenant');
  }

  const now = new Date().toISOString();
  const memberId = crypto.randomUUID();

  // Add user to tenant
  await db.prepare(`
    INSERT INTO tenant_members (id, tenant_id, user_id, role, permissions, invited_by, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).bind(memberId, tenantId, user.id, role, JSON.stringify(permissions || []), userId, now).run();

  return c.json({
    message: 'User invited successfully',
    userId: user.id,
    email,
    role,
  }, 201);
});

/**
 * PATCH /users/:id
 * Update user (within current tenant)
 */
userRoutes.patch('/:id', zValidator('json', updateUserSchema), async (c) => {
  const userId = c.req.param('id');
  const currentUserId = c.get('userId');
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!existing) {
    throw errors.notFound('User');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.email) {
    updates.push('email = ?');
    values.push(body.email);
  }
  if (body.name) {
    updates.push('name = ?');
    values.push(body.name);
  }
  if (body.status) {
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' });
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(userId);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  await c.env.DB.prepare(query).bind(...values).run();

  // Update tenant membership role if provided
  if (body.role) {
    await c.env.DB.prepare(`
      UPDATE tenant_members SET role = ? WHERE user_id = ? AND tenant_id = ?
    `).bind(body.role, userId, tenantId).run();
  }

  return c.json({ message: 'User updated successfully' });
});

/**
 * DELETE /users/:id
 * Remove user from current tenant (soft delete - doesn't delete user account)
 */
userRoutes.delete('/:id', async (c) => {
  const userId = c.req.param('id');
  const tenantId = c.get('tenantId');

  // Check if user exists in tenant
  const existing: any = await c.env.DB.prepare(`
    SELECT id FROM tenant_members WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).first();

  if (!existing) {
    throw errors.notFound('User is not a member of this tenant');
  }

  // Prevent deleting yourself
  if (userId === c.get('userId')) {
    throw errors.forbidden('Cannot remove yourself from the tenant');
  }

  // Remove from tenant (soft delete - just remove membership)
  await c.env.DB.prepare(`
    DELETE FROM tenant_members WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).run();

  return c.json({ message: 'User removed from tenant successfully' });
});

/**
 * POST /users/:id/leave
 * Remove current user from tenant
 */
userRoutes.post('/:id/leave', async (c) => {
  const userId = c.req.param('id');
  const currentUserId = c.get('userId');
  const tenantId = c.get('tenantId');

  if (userId !== currentUserId) {
    throw errors.forbidden('Can only remove yourself');
  }

  // Check if user is the last owner
  const owners: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM tenant_members 
    WHERE tenant_id = ? AND role = 'owner' AND status = 'active'
  `).bind(tenantId).first();

  if (owners.count === 1) {
    throw errors.forbidden('Cannot leave: you are the last owner. Transfer ownership first.');
  }

  await c.env.DB.prepare(`
    DELETE FROM tenant_members WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).run();

  return c.json({ message: 'Successfully left the tenant' });
});

/**
 * POST /users/change-password
 * Change current user password
 */
userRoutes.post('/change-password', zValidator('json', changePasswordSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid('json');
  const userId = c.get('userId');
  
  const user: any = await c.env.DB.prepare(
    'SELECT password FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    throw errors.unauthorized('Current password is incorrect');
  }

  const hashedPassword = await hashPassword(newPassword);
  await c.env.DB.prepare(`
    UPDATE users SET password = ?, updated_at = ? WHERE id = ?
  `).bind(hashedPassword, new Date().toISOString(), userId).run();

  return c.json({ message: 'Password changed successfully' });
});
