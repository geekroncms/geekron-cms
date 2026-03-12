import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { tenantMiddleware } from './middleware/tenant';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './utils/errors';
import { healthRoutes } from './routes/health';
import { tenantRoutes } from './routes/tenants';
import { userRoutes } from './routes/users';
import { collectionRoutes } from './routes/collections';
import { collectionDataRoutes } from './routes/collection-data';
import { fileRoutes } from './routes/files';
import { apiKeysRoutes } from './routes/api-keys';

// Type definitions
type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
  BUCKET_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};

type Variables = {
  tenantId: string;
  userId: string;
  role: string;
};

// Create application
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Global error handler
app.use('*', errorHandler());

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://cms.geekron-cms.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key'],
  credentials: true,
}));

// Health check (no auth required)
app.route('/health', healthRoutes);

// API routes
const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Auth routes (partial auth - login/register are public)
api.route('/auth', userRoutes);

// Protected routes
const protectedApi = new Hono<{ Bindings: Bindings; Variables: Variables }>();
protectedApi.use('/*', authMiddleware);
protectedApi.use('/*', tenantMiddleware);

// Register protected routes
protectedApi.route('/tenants', tenantRoutes);
protectedApi.route('/collections', collectionRoutes);
protectedApi.route('/data', collectionDataRoutes);
protectedApi.route('/files', fileRoutes);
protectedApi.route('/api-keys', apiKeysRoutes);

// Mount protected routes
api.route('/', protectedApi);

// Mount API
app.route('/api/v1', api);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    error: 'NOT_FOUND', 
    message: 'Resource not found',
    path: c.req.path 
  }, 404);
});

// Global error handler (fallback)
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    error: 'INTERNAL_ERROR', 
    message: 'Internal server error' 
  }, 500);
});

export default app;
