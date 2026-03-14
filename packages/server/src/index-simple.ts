import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

// Type definitions
type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

type Variables = {
  tenantId: string
  userId: string
  email: string
  role: string
}

// Create application
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://0e38f78a.geekron-cms-admin.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key'],
    credentials: true,
  }),
)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.0.1',
  })
})

// Auth routes
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    if (!email || !password) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Email and password required' }, 400)
    }
    
    // Query user from database
    const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
    
    if (!user) {
      return c.json({ error: 'INVALID_CREDENTIALS', message: 'User not found' }, 404)
    }
    
    // Simple password check (in production, use bcrypt)
    const hashedInput = await hashPassword(password)
    
    // For demo, accept any password that matches our demo user
    if (email === 'demo@geekron-cms.com' && password === 'Demo123456') {
      const token = await generateToken(user.id, 'demo-tenant-001', user.email, user.role)
      
      return c.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        tenant: {
          id: 'demo-tenant-001',
          name: '演示租户',
          slug: 'demo',
        },
      })
    }
    
    return c.json({ error: 'INVALID_CREDENTIALS', message: 'Incorrect password' }, 401)
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Login failed' }, 500)
  }
})

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    
    if (!email || !password || !name) {
      return c.json({ error: 'INVALID_REQUEST', message: 'All fields required' }, 400)
    }
    
    // Check if user exists
    const existing: any = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    
    if (existing) {
      return c.json({ error: 'USER_EXISTS', message: 'User already exists' }, 409)
    }
    
    const userId = crypto.randomUUID()
    const hashedPassword = await hashPassword(password)
    const now = new Date().toISOString()
    
    // Create user
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password, name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, hashedPassword, name, 'owner', 'active', now).run()
    
    return c.json({ success: true, message: 'User created successfully' })
  } catch (error: any) {
    console.error('Register error:', error)
    return c.json({ error: 'INTERNAL_ERROR', message: 'Registration failed' }, 500)
  }
})

app.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Token required' }, 401)
    }
    
    const token = authHeader.substring(7)
    
    // For demo, just return mock data
    return c.json({
      id: 'demo-user-id',
      email: 'demo@geekron-cms.com',
      name: '演示用户',
      role: 'owner',
      tenantId: 'demo-tenant-001',
    })
  } catch (error: any) {
    return c.json({ error: 'INTERNAL_ERROR', message: 'Failed to get user info' }, 500)
  }
})

// Helper functions
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'geekron-cms-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '$2a$10$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateToken(userId: string, tenantId: string, email: string, role: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify({
    sub: userId,
    tenant_id: tenantId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h
  }))
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return 'demo_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 64)
}

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'NOT_FOUND',
      message: 'Resource not found',
      path: c.req.path,
    },
    404,
  )
})

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
    500,
  )
})

export default app
