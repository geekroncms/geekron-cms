import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { createLogger } from './utils/logger'

const logger = createLogger('Server')

import { apiKeyAuthMiddleware } from './middleware/api-key-auth'
import { quotaCheckMiddleware } from './middleware/quota-check'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { tenantMiddleware } from './middleware/tenant'
import { tenantIsolationMiddleware } from './middleware/tenant-isolation'
import { apiKeysRoutes } from './routes/api-keys'
import { authRoutes } from './routes/auth'
import { collectionDataRoutes } from './routes/collection-data'
import { collectionRoutes } from './routes/collections'
import { fileRoutes } from './routes/files'
import { healthRoutes } from './routes/health'
import { metadataRoutes } from './routes/metadata'
import { quotaRoutes } from './routes/quotas'
import { tenantRoutes } from './routes/tenants'
import { userRoutes } from './routes/users'
import { dynamicCrudRoutes } from './services/dynamic-crud'
import { ApiError } from './utils/errors'

// Type definitions
type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  KV: KVNamespace
  JWT_SECRET: string
  BUCKET_URL?: string
  SUPABASE_URL: string
  SUPABASE_KEY: string
}

type Variables = {
  tenantId: string
  userId: string
  email: string
  role: string
  permissions: string[]
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
  }
  safeDB: any // Tenant-safe database proxy
  quotaStatus: any // Quota status from quota-check middleware
}

// Create application
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Middleware
app.use('*', honoLogger())
app.use('*', prettyJSON())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://cms.geekron-cms.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key'],
    credentials: true,
  }),
)

// Health check (no auth required)
app.route('/health', healthRoutes)

// API routes
const api = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Auth routes (login/register are public, others require auth)
api.route('/auth', authRoutes)

// Protected routes
const protectedApi = new Hono<{ Bindings: Bindings; Variables: Variables }>()
protectedApi.use('/*', apiKeyAuthMiddleware)
protectedApi.use('/*', tenantMiddleware)
protectedApi.use('/*', tenantIsolationMiddleware)
protectedApi.use('/*', rateLimitMiddleware)
protectedApi.use('/*', quotaCheckMiddleware)

// Register protected routes
protectedApi.route('/tenants', tenantRoutes)
protectedApi.route('/users', userRoutes)
protectedApi.route('/collections', collectionRoutes)
protectedApi.route('/data', collectionDataRoutes)
protectedApi.route('/dynamic-data', dynamicCrudRoutes) // Phase 3: Dynamic CRUD
protectedApi.route('/files', fileRoutes)
protectedApi.route('/api-keys', apiKeysRoutes)
protectedApi.route('/quotas', quotaRoutes)
protectedApi.route('/metadata', metadataRoutes) // Phase 3: Metadata Management

// Mount protected routes
api.route('/', protectedApi)

// Mount API
app.route('/api/v1', api)

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

// Global error handler - handles ApiError and other errors
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        error: err.code,
        message: err.message,
        details: err.details,
      },
      err.statusCode,
    )
  }

  // Zod validation errors
  if (err?.name === 'ZodError') {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err?.errors,
      },
      400,
    )
  }

  // Log and return internal error
  logger.error('Unhandled error', err)
  return c.json(
    {
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
    500,
  )
})

export default app
