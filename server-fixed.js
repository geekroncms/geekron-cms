export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-API-Key',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Health check - no DB required
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        worker: 'geekron-cms-server',
      }), { headers: corsHeaders })
    }

    // API routes
    if (url.pathname === '/api/auth/login') {
      try {
        const { email, password } = await request.json()
        
        if (!email || !password) {
          return new Response(JSON.stringify({
            error: 'INVALID_REQUEST',
            message: 'Email and password required',
          }), { status: 400, headers: corsHeaders })
        }

        // Query user from D1
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
        
        if (!user) {
          return new Response(JSON.stringify({
            error: 'USER_NOT_FOUND',
            message: 'User does not exist',
          }), { status: 404, headers: corsHeaders })
        }

        // For demo user, accept Demo123456 password
        // For other users, would need proper password verification
        const isValidPassword = (email === 'demo@geekron-cms.com' && password === 'Demo123456')
        
        if (!isValidPassword) {
          return new Response(JSON.stringify({
            error: 'INVALID_PASSWORD',
            message: 'Incorrect password',
          }), { status: 401, headers: corsHeaders })
        }

        // Get tenant info
        const member = await env.DB.prepare(
          'SELECT tm.*, t.name as tenant_name, t.slug as tenant_slug FROM tenant_members tm JOIN tenants t ON tm.tenant_id = t.id WHERE tm.user_id = ?'
        ).bind(user.id).first()

        const tenantId = member?.tenant_id || 'demo-tenant-001'
        const tenantName = member?.tenant_name || '演示租户'
        const tenantSlug = member?.tenant_slug || 'demo'
        const role = member?.role || user.role || 'owner'

        // Generate token
        const token = await generateToken(user.id, tenantId, user.email, role, env.JWT_SECRET)

        return new Response(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role,
          },
          tenant: {
            id: tenantId,
            name: tenantName,
            slug: tenantSlug,
          },
        }), { headers: corsHeaders })

      } catch (error) {
        console.error('Login error:', error)
        return new Response(JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: 'Login failed: ' + error.message,
        }), { status: 500, headers: corsHeaders })
      }
    }

    // Auth me endpoint
    if (url.pathname === '/api/auth/me') {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Token required',
        }), { status: 401, headers: corsHeaders })
      }

      // For demo, return mock data
      return new Response(JSON.stringify({
        id: 'demo-user-id',
        email: 'demo@geekron-cms.com',
        name: '演示用户',
        role: 'owner',
        tenantId: 'demo-tenant-001',
      }), { headers: corsHeaders })
    }

    // 404 for other routes
    return new Response(JSON.stringify({
      error: 'NOT_FOUND',
      message: 'Endpoint not found',
    }), { status: 404, headers: corsHeaders })
  }
}

async function generateToken(userId, tenantId, email, role, secret) {
  const payload = {
    sub: userId,
    tenant_id: tenantId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }
  
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return 'gk_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 64)
}
