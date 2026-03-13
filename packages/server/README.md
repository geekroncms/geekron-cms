# Geekron CMS Server

Backend server for Geekron CMS built with Hono, Cloudflare Workers, D1 Database,
and R2 Storage.

## Features

✅ **Authentication & Authorization**

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control (owner, admin, editor, viewer)
- API key management

✅ **Multi-tenancy**

- Tenant isolation at database level
- Tenant-scoped resources
- Automatic tenant context injection

✅ **Dynamic Data Models**

- Create custom collections (data models)
- Define custom fields per collection
- Full CRUD operations on collection data
- JSON-based flexible schema

✅ **File Management**

- R2 storage integration
- Multipart upload support for large files
- File type validation
- Automatic public URL generation

✅ **API Keys**

- Generate secure API keys
- Permission-based access
- Expiration support
- Key rotation

✅ **Developer Experience**

- TypeScript support
- Zod validation
- Comprehensive error handling
- Unit tests with Bun
- API documentation

## Tech Stack

- **Runtime:** Cloudflare Workers (Bun for local development)
- **Framework:** Hono
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Validation:** Zod
- **Testing:** Bun Test
- **Password Hashing:** bcryptjs
- **JWT:** jose

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Cloudflare Workers account (for deployment)
- Wrangler CLI

### Installation

```bash
# Install dependencies
bun install

# Or with npm
npm install
```

### Local Development

```bash
# Start development server with hot reload
bun run dev

# Or with Wrangler (Cloudflare Workers)
wrangler dev
```

The server will start at `http://localhost:3000`

### Database Setup

```bash
# Run migrations
bun run db:migrate

# Seed database with sample data
bun run db:seed
```

### Run Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/users.test.ts
```

### Build for Production

```bash
# Build for Cloudflare Workers
bun run build
```

## Project Structure

```
packages/server/
├── src/
│   ├── index.ts              # Main entry point
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   └── tenant.ts         # Tenant context
│   ├── routes/
│   │   ├── health.ts         # Health check
│   │   ├── tenants.ts        # Tenant management
│   │   ├── users.ts          # User auth & CRUD
│   │   ├── collections.ts    # Collection schema
│   │   ├── collection-data.ts # Dynamic data CRUD
│   │   ├── files.ts          # File upload (R2)
│   │   └── api-keys.ts       # API key management
│   ├── db/
│   │   ├── schema.ts         # Database schema
│   │   ├── migrate.ts        # Migration runner
│   │   └── seed.ts           # Sample data
│   └── utils/
│       ├── password.ts       # Password hashing
│       └── errors.ts         # Error handling
├── tests/
│   ├── users.test.ts
│   ├── api-keys.test.ts
│   ├── collection-data.test.ts
│   └── utils.test.ts
├── package.json
├── tsconfig.json
└── API.md                      # API documentation
```

## Environment Variables

Create a `.dev.vars` file for local development:

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
BUCKET_URL=https://your-bucket.r2.dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

## API Endpoints

See [API.md](./API.md) for complete API documentation.

### Quick Reference

| Method | Endpoint                     | Description       |
| ------ | ---------------------------- | ----------------- |
| POST   | `/api/v1/auth/register`      | Register user     |
| POST   | `/api/v1/auth/login`         | Login             |
| GET    | `/api/v1/auth/me`            | Get current user  |
| GET    | `/api/v1/users`              | List users        |
| POST   | `/api/v1/users`              | Create user       |
| POST   | `/api/v1/collections`        | Create collection |
| GET    | `/api/v1/data/:collectionId` | List data         |
| POST   | `/api/v1/data`               | Create data entry |
| POST   | `/api/v1/files/upload`       | Upload file       |
| POST   | `/api/v1/api-keys`           | Create API key    |

## Authentication

### JWT Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Use the returned token:

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### API Key

```bash
curl -X GET http://localhost:3000/api/v1/collections \
  -H "X-API-Key: gk_your-api-key"
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

Common error codes:

- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INVALID_INPUT` (400)
- `INTERNAL_ERROR` (500)

## Testing

Tests are written using Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run with verbose output
bun test --verbose

# Run tests matching pattern
bun test --test-name-pattern="password"
```

## Deployment

### Cloudflare Workers

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

### Environment Configuration

Update `wrangler.toml`:

```toml
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

## Security Considerations

1. **Password Hashing:** Uses bcryptjs with 10 salt rounds
2. **JWT Tokens:** 24-hour expiration, HS256 algorithm
3. **API Keys:** SHA-256 hashed before storage
4. **Tenant Isolation:** All queries include tenant_id
5. **Input Validation:** Zod schemas on all endpoints
6. **CORS:** Configured for specific origins

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT

## Support

For issues and questions:

- GitHub Issues: https://github.com/GeekronCMS/geekron-cms/issues
- Documentation: https://docs.geekron-cms.com
