# Development Setup Guide

## Prerequisites

### Option 1: Bun (Recommended)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

### Option 2: Node.js + npm

```bash
# Node.js 18+ required
node --version  # Should be v18 or higher
npm --version
```

## Installation

### With Bun

```bash
cd packages/server
bun install
```

### With npm

```bash
cd packages/server
npm install
```

## Environment Setup

Create a `.dev.vars` file in the `packages/server` directory:

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
BUCKET_URL=https://your-bucket.r2.dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

## Database Setup

### Local Development (SQLite)

If using Bun with better-sqlite3:

```bash
# Create local database directory
mkdir -p .data

# Run migrations
bun run db:migrate

# Seed sample data
bun run db:seed
```

### Cloudflare D1

```bash
# Create D1 database
wrangler d1 create geekron-cms

# Update wrangler.toml with database_id

# Run migrations
wrangler d1 execute geekron-cms --local
```

## Running the Server

### Development Mode (Bun)

```bash
# Hot reload enabled
bun run dev
```

### Development Mode (Wrangler)

```bash
# Cloudflare Workers local environment
wrangler dev
```

### Production Build

```bash
# Build for deployment
bun run build
```

## Running Tests

```bash
# All tests
bun test

# With coverage
bun test --coverage

# Specific test file
bun test tests/users.test.ts

# Verbose output
bun test --verbose
```

## Testing API Endpoints

### 1. Register a User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "name": "Admin User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

Save the returned `token` for subsequent requests.

### 3. Get Current User

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Create a Collection

```bash
curl -X POST http://localhost:3000/api/v1/collections \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Articles",
    "slug": "articles",
    "description": "Blog articles",
    "fields": [
      {
        "name": "title",
        "type": "text",
        "required": true
      },
      {
        "name": "content",
        "type": "text",
        "required": true
      }
    ]
  }'
```

### 5. Create Data Entry

```bash
curl -X POST http://localhost:3000/api/v1/data \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "collectionId": "YOUR_COLLECTION_ID",
    "data": {
      "title": "My First Article",
      "content": "Hello World!"
    }
  }'
```

### 6. Upload a File

```bash
curl -X POST "http://localhost:3000/api/v1/files/upload?folder=articles" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/your/file.pdf"
```

### 7. Create API Key

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "permissions": ["read", "write"],
    "expiresAt": "2027-12-31T23:59:59Z"
  }'
```

Save the returned API key - it won't be shown again!

### 8. Use API Key for Authentication

```bash
curl -X GET http://localhost:3000/api/v1/collections \
  -H "X-API-Key: gk_your-api-key-here"
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Module Resolution Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
bun install
```

### Database Migration Errors

```bash
# Drop and recreate local database
rm -rf .data
mkdir -p .data
bun run db:migrate
```

### TypeScript Errors

```bash
# Check TypeScript configuration
bun tsc --noEmit

# Fix any type errors
```

## Deployment

### Cloudflare Workers

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Login to Cloudflare:

```bash
wrangler login
```

3. Configure `wrangler.toml`:

```toml
name = "geekron-cms-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
JWT_SECRET = "your-production-secret"

[[d1_databases]]
binding = "DB"
database_name = "geekron-cms"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "geekron-cms-files"
```

4. Deploy:

```bash
wrangler deploy
```

### Environment Variables in Production

Set these in Cloudflare Dashboard or via Wrangler:

```bash
wrangler secret put JWT_SECRET
wrangler secret put SUPABASE_KEY
```

## Performance Tips

1. **Use API Keys** for server-to-server communication (faster than JWT)
2. **Enable R2 public access** for frequently accessed files
3. **Use pagination** for large data sets
4. **Implement caching** at CDN level for read-heavy endpoints
5. **Batch operations** when creating multiple data entries

## Security Best Practices

1. **Rotate API keys** regularly
2. **Use strong JWT secrets** (32+ characters)
3. **Enable CORS** only for trusted origins
4. **Validate all inputs** (already done with Zod)
5. **Use HTTPS** in production
6. **Monitor rate limits** and implement throttling
7. **Audit logs** for sensitive operations

## Additional Resources

- [Hono Documentation](https://hono.dev/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Zod Documentation](https://zod.dev/)
- [Bun Documentation](https://bun.sh/docs)
