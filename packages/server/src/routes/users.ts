import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SignJWT } from 'jose';
import { hashPassword, comparePassword } from '../utils/password';
import { errors, ApiError } from '../utils/errors';

export const userRoutes = new Hono();

// ==================== Schema Definitions ====================

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  tenantId: z.string().optional(),
});

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).default('viewer'),
  status: z.enum(['active', 'inactive', 'banned']).default('active'),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// ==================== Authentication Routes ====================

/**
 * POST /auth/login
 * User login
 */
userRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user: any = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    throw errors.unauthorized('Invalid credentials');
  }

  if (user.status !== 'active') {
    throw errors.forbidden('Account is not active');
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    throw errors.unauthorized('Invalid credentials');
  }

  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key';
  const token = await new SignJWT({ 
    sub: user.id, 
    email: user.email,
    role: user.role 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(jwtSecret));

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * POST /auth/register
 * User registration
 */
userRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name, tenantId } = c.req.valid('json');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    throw errors.conflict('Email already registered');
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, email, password, name, role, status, created_at)
    VALUES (?, ?, ?, ?, 'viewer', 'active', datetime('now'))
  `).bind(userId, email, hashedPassword, name).run();

  return c.json({
    id: userId,
    email,
    name,
    message: 'User registered successfully',
  }, 201);
});

/**
 * GET /auth/me
 * Get current user info
 */
userRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  
  const user: any = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  return c.json(user);
});

/**
 * POST /auth/change-password
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
    UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(hashedPassword, userId).run();

  return c.json({ message: 'Password changed successfully' });
});

// ==================== User Management Routes (Admin) ====================

/**
 * GET /users
 * List all users (tenant-scoped)
 */
userRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const users: any = await c.env.DB.prepare(`
    SELECT id, email, name, role, status, created_at, updated_at 
    FROM users 
    WHERE tenant_id = ? OR tenant_id IS NULL
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(tenantId, limit, offset).all();

  const total: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM users WHERE tenant_id = ? OR tenant_id IS NULL
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
 * Get user by ID
 */
userRoutes.get('/:id', async (c) => {
  const userId = c.req.param('id');
  
  const user: any = await c.env.DB.prepare(`
    SELECT id, email, name, role, status, tenant_id, created_at, updated_at 
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  return c.json(user);
});

/**
 * POST /users
 * Create a new user
 */
userRoutes.post('/', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json');
  const tenantId = c.get('tenantId');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(body.email).first();

  if (existing) {
    throw errors.conflict('Email already exists');
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(body.password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, tenant_id, email, password, name, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(userId, tenantId, body.email, hashedPassword, body.name, body.role, body.status).run();

  return c.json({
    id: userId,
    email: body.email,
    name: body.name,
    role: body.role,
    status: body.status,
    message: 'User created successfully',
  }, 201);
});

/**
 * PATCH /users/:id
 * Update user
 */
userRoutes.patch('/:id', zValidator('json', updateUserSchema), async (c) => {
  const userId = c.req.param('id');
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
  if (body.role) {
    updates.push('role = ?');
    values.push(body.role);
  }
  if (body.status) {
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) {
    return c.json({ message: 'No updates provided' });
  }

  updates.push('updated_at = datetime(\'now\')');
  values.push(userId);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  await c.env.DB.prepare(query).bind(...values).run();

  return c.json({ message: 'User updated successfully' });
});

/**
 * DELETE /users/:id
 * Delete user
 */
userRoutes.delete('/:id', async (c) => {
  const userId = c.req.param('id');

  const existing: any = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!existing) {
    throw errors.notFound('User');
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  return c.json({ message: 'User deleted successfully' });
});
