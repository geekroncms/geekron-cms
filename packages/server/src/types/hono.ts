import type { Context } from 'hono'

// Type definitions for Hono context
export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  KV: KVNamespace
  JWT_SECRET: string
  BUCKET_URL?: string
  SUPABASE_URL: string
  SUPABASE_KEY: string
}

export type Variables = {
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
}

// Typed context helper
export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>
