import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SignJWT, jwtVerify } from 'jose';
import { hashPassword, comparePassword } from '../utils/password';
import { errors, ApiError } from '../utils/errors';

export const authRoutes = new Hono();

// ==================== Schema Definitions ====================

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenantId: z.string().optional().describe('Target tenant ID for login'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  tenantName: z.string().min(1, 'Tenant name is required').max(100),
  tenantSlug: z.string().regex(/^[a-z0-9-]+$/, 'Tenant slug must be lowercase alphanumeric with hyphens'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

const switchTenantSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID format'),
});

// ==================== Helper Functions ====================

/**
 * Generate JWT token with tenant context
 */
async function generateToken(
  userId: string,
  tenantId: string,
  email: string,
  role: string,
  permissions: string[],
  jwtSecret: string
) {
  const token = await new SignJWT({
    sub: userId,
    email,
    role,
    tenant_id: tenantId,
    permissions,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(new TextEncoder().encode(jwtSecret));

  return token;
}

/**
 * Get user's tenants from database
 */
async function getUserTenants(db: any, userId: string) {
  // First, get tenants where user is directly associated
  const directTenants: any[] = await db.prepare(`
    SELECT t.id, t.name, t.slug, t.plan, t.status, u.role, u.created_at as joined_at
    FROM tenants t
    INNER JOIN tenant_members tm ON t.id = tm.tenant_id
    INNER JOIN users u ON tm.user_id = u.id
    WHERE u.id = ? AND t.status = 'active'
    ORDER BY tm.created_at DESC
  `).bind(userId).all();

  return directTenants.results || [];
}

/**
 * Get user's permissions for a specific tenant
 */
async function getUserPermissions(db: any, userId: string, tenantId: string) {
  const member: any = await db.prepare(`
    SELECT role, permissions FROM tenant_members
    WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).first();

  if (!member) {
    return [];
  }

  // Default permissions based on role
  const rolePermissions: Record<string, string[]> = {
    owner: ['read', 'write', 'delete', 'admin', 'manage_users', 'manage_settings'],
    admin: ['read', 'write', 'delete', 'manage_users'],
    editor: ['read', 'write'],
    viewer: ['read'],
  };

  const basePermissions = rolePermissions[member.role] || ['read'];
  const customPermissions = member.permissions || [];

  return [...new Set([...basePermissions, ...(customPermissions || [])])];
}

// ==================== Authentication Routes ====================

/**
 * POST /auth/login
 * User login with tenant context
 */
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, tenantId } = c.req.valid('json');
  const db = c.env.DB;
  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key';

  // Find user by email
  const user: any = await db.prepare(
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

  // Determine tenant context
  let targetTenantId = tenantId;

  if (!targetTenantId) {
    // Get user's first/default tenant
    const tenants = await getUserTenants(db, user.id);
    if (tenants.length === 0) {
      throw errors.forbidden('User is not associated with any active tenant');
    }
    targetTenantId = tenants[0].id;
  }

  // Verify user has access to the target tenant
  const member: any = await db.prepare(`
    SELECT role, permissions FROM tenant_members
    WHERE user_id = ? AND tenant_id = ?
  `).bind(user.id, targetTenantId).first();

  if (!member) {
    throw errors.forbidden('User does not have access to this tenant');
  }

  // Get tenant info
  const tenant: any = await db.prepare(
    'SELECT id, name, slug, plan, status FROM tenants WHERE id = ?'
  ).bind(targetTenantId).first();

  if (!tenant || tenant.status !== 'active') {
    throw errors.forbidden('Tenant is not active');
  }

  // Get permissions
  const permissions = await getUserPermissions(db, user.id, targetTenantId);

  // Generate token with tenant context
  const token = await generateToken(
    user.id,
    targetTenantId,
    user.email,
    member.role,
    permissions,
    jwtSecret
  );

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    },
    role: member.role,
    permissions,
  });
});

/**
 * POST /auth/register
 * User registration with new tenant creation
 */
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name, tenantName, tenantSlug } = c.req.valid('json');
  const db = c.env.DB;

  // Check if user already exists
  const existingUser: any = await db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existingUser) {
    throw errors.conflict('Email already registered');
  }

  // Check if tenant slug already exists
  const existingTenant: any = await db.prepare(
    'SELECT id FROM tenants WHERE slug = ?'
  ).bind(tenantSlug).first();

  if (existingTenant) {
    throw errors.conflict('Tenant slug already taken');
  }

  const userId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();

  // Create user and tenant in a transaction
  await db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?)
  `).bind(userId, email, hashedPassword, name, now, now).run();

  await db.prepare(`
    INSERT INTO tenants (id, name, slug, email, plan, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'free', 'active', ?, ?)
  `).bind(tenantId, tenantName, tenantSlug, email, now, now).run();

  // Link user to tenant as owner
  await db.prepare(`
    INSERT INTO tenant_members (id, tenant_id, user_id, role, permissions, created_at)
    VALUES (?, ?, ?, 'owner', null, ?)
  `).bind(crypto.randomUUID(), tenantId, userId, now).run();

  return c.json({
    user: {
      id: userId,
      email,
      name,
    },
    tenant: {
      id: tenantId,
      name: tenantName,
      slug: tenantSlug,
    },
    message: 'User and tenant created successfully',
  }, 201);
});

/**
 * GET /auth/me
 * Get current user info with tenant context
 */
authRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const db = c.env.DB;

  const user: any = await db.prepare(`
    SELECT id, email, name, role, status, created_at, updated_at 
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  // Get current tenant info
  const tenant: any = await db.prepare(
    'SELECT id, name, slug, plan, status FROM tenants WHERE id = ?'
  ).bind(tenantId).first();

  // Get user's role and permissions in current tenant
  const member: any = await db.prepare(`
    SELECT role, permissions FROM tenant_members
    WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).first();

  const permissions = await getUserPermissions(db, userId, tenantId);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    } : null,
    role: member?.role || 'viewer',
    permissions,
  });
});

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
authRoutes.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw errors.unauthorized('Authorization header required');
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key';

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    const payload = verified.payload as any;

    const userId = payload.sub;
    const tenantId = payload.tenant_id;
    const email = payload.email;

    // Verify user and tenant still exist and are active
    const user: any = await c.env.DB.prepare(
      'SELECT status FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user || user.status !== 'active') {
      throw errors.forbidden('User account is not active');
    }

    const tenant: any = await c.env.DB.prepare(
      'SELECT status FROM tenants WHERE id = ?'
    ).bind(tenantId).first();

    if (!tenant || tenant.status !== 'active') {
      throw errors.forbidden('Tenant is not active');
    }

    // Get updated permissions
    const permissions = await getUserPermissions(c.env.DB, userId, tenantId);
    const member: any = await c.env.DB.prepare(`
      SELECT role FROM tenant_members WHERE user_id = ? AND tenant_id = ?
    `).bind(userId, tenantId).first();

    // Generate new token
    const newToken = await generateToken(
      userId,
      tenantId,
      email,
      member?.role || 'viewer',
      permissions,
      jwtSecret
    );

    return c.json({
      token: newToken,
      message: 'Token refreshed successfully',
    });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JOSEError') {
      throw errors.unauthorized('Token expired or invalid');
    }
    throw error;
  }
});

/**
 * GET /auth/tenants
 * Get all tenants user belongs to
 */
authRoutes.get('/tenants', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const tenants = await getUserTenants(db, userId);

  return c.json({
    tenants: tenants.map((t: any) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      role: t.role,
      joinedAt: t.joined_at,
    })),
    total: tenants.length,
  });
});

/**
 * POST /auth/switch-tenant
 * Switch to a different tenant context
 */
authRoutes.post('/switch-tenant', zValidator('json', switchTenantSchema), async (c) => {
  const { tenantId } = c.req.valid('json');
  const userId = c.get('userId');
  const db = c.env.DB;
  const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key';

  // Verify user has access to the target tenant
  const member: any = await db.prepare(`
    SELECT role, permissions FROM tenant_members
    WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).first();

  if (!member) {
    throw errors.forbidden('User does not have access to this tenant');
  }

  // Get tenant info
  const tenant: any = await db.prepare(
    'SELECT id, name, slug, plan, status FROM tenants WHERE id = ?'
  ).bind(tenantId).first();

  if (!tenant || tenant.status !== 'active') {
    throw errors.forbidden('Tenant is not active');
  }

  // Get user info
  const user: any = await db.prepare(
    'SELECT email FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw errors.notFound('User');
  }

  // Get permissions
  const permissions = await getUserPermissions(db, userId, tenantId);

  // Generate new token with new tenant context
  const token = await generateToken(
    userId,
    tenantId,
    user.email,
    member.role,
    permissions,
    jwtSecret
  );

  return c.json({
    token,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    },
    role: member.role,
    permissions,
    message: 'Tenant context switched successfully',
  });
});

/**
 * POST /auth/logout
 * Logout (optional - client should discard token)
 */
authRoutes.post('/logout', async (c) => {
  // In a stateless JWT system, logout is handled client-side by discarding the token
  // Optionally, you could implement a token blacklist here
  
  return c.json({
    message: 'Logged out successfully',
  });
});
