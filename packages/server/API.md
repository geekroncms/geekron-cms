# Geekron CMS API Documentation

Base URL: `/api/v1`

## Authentication

Most endpoints require authentication via JWT token or API key.

### JWT Token

Include in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### API Key

Include in X-API-Key header:

```
X-API-Key: gk_<your-api-key>
```

---

## Authentication Endpoints

### POST `/auth/register`

Register a new user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "message": "User registered successfully"
}
```

### POST `/auth/login`

Login and receive JWT token.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "viewer"
  }
}
```

### GET `/auth/me`

Get current user info.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "status": "active",
  "created_at": "2026-03-12T08:00:00Z",
  "updated_at": "2026-03-12T08:00:00Z"
}
```

### POST `/auth/change-password`

Change current user password.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

---

## User Management

### GET `/users`

List all users (tenant-scoped).

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET `/users/:id`

Get user by ID.

### POST `/users`

Create a new user.

**Request:**

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "role": "editor",
  "status": "active"
}
```

### PATCH `/users/:id`

Update user.

**Request:**

```json
{
  "name": "Updated Name",
  "role": "admin"
}
```

### DELETE `/users/:id`

Delete user.

---

## Collections (Data Models)

### POST `/collections`

Create a new collection (data model).

**Request:**

```json
{
  "name": "Articles",
  "slug": "articles",
  "description": "Blog articles",
  "fields": [
    {
      "name": "title",
      "type": "text",
      "required": true,
      "unique": false
    },
    {
      "name": "content",
      "type": "text",
      "required": true
    },
    {
      "name": "published",
      "type": "boolean",
      "default": false
    }
  ]
}
```

### GET `/collections`

List all collections.

### GET `/collections/:id`

Get collection details with fields.

### DELETE `/collections/:id`

Delete collection.

---

## Collection Data (Dynamic Content)

### POST `/data`

Create a new data entry.

**Request:**

```json
{
  "collectionId": "collection-uuid",
  "data": {
    "title": "My Article",
    "content": "Article content here...",
    "published": true
  }
}
```

### GET `/data/:collectionId`

List data entries in a collection.

**Query Parameters:**

- `page`, `limit`
- `filter` (JSON string): `{"status": "published"}`
- `sort`: field name
- `order`: `asc` or `desc`

### GET `/data/:collectionId/:id`

Get single data entry.

### PATCH `/data/:collectionId/:id`

Update data entry.

**Request:**

```json
{
  "data": {
    "title": "Updated Title",
    "published": false
  }
}
```

### DELETE `/data/:collectionId/:id`

Delete data entry.

### POST `/data/:collectionId/bulk`

Bulk create data entries.

**Request:**

```json
{
  "items": [
    { "title": "Article 1", "content": "..." },
    { "title": "Article 2", "content": "..." }
  ]
}
```

---

## File Management

### POST `/files/upload`

Upload a file to R2 storage.

**Query Parameters:**

- `name` (optional): Custom filename
- `folder` (default: 'uploads')

**FormData:**

- `file`: The file to upload

**Response (201):**

```json
{
  "id": "file-uuid",
  "name": "document.pdf",
  "url": "https://bucket_url/uploads/tenant-id/file.pdf",
  "r2Key": "uploads/tenant-id/file.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "message": "File uploaded successfully"
}
```

**Supported MIME Types:**

- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Documents: `application/pdf`, `application/msword`, etc.
- Spreadsheets: `application/vnd.ms-excel`, etc.
- Text: `text/plain`, `text/csv`, `application/json`
- Media: `video/mp4`, `audio/mpeg`

**Max File Size:** 50MB (500MB for multipart uploads)

### GET `/files`

List all files.

### GET `/files/:id`

Get file info.

### GET `/files/:id/download`

Download file content.

### DELETE `/files/:id`

Delete file.

---

## API Keys

### POST `/api-keys`

Create a new API key.

**Request:**

```json
{
  "name": "Production API Key",
  "permissions": ["read", "write"],
  "expiresAt": "2027-12-31T23:59:59Z"
}
```

**Response (201):**

```json
{
  "id": "key-uuid",
  "name": "Production API Key",
  "key": "gk_a1b2c3d4e5f6...",
  "permissions": ["read", "write"],
  "expiresAt": "2027-12-31T23:59:59Z",
  "message": "API key created successfully. Store this key securely - it cannot be retrieved again."
}
```

⚠️ **Important:** The API key is only shown once. Store it securely.

### GET `/api-keys`

List all API keys (keys are not exposed).

### GET `/api-keys/:id`

Get API key info.

### PATCH `/api-keys/:id`

Update API key.

### DELETE `/api-keys/:id`

Revoke API key.

### POST `/api-keys/:id/rotate`

Rotate API key (generate new key).

**Response:**

```json
{
  "id": "key-uuid",
  "key": "gk_newkey...",
  "message": "API key rotated successfully. Store this new key securely."
}
```

### POST `/api-keys/validate`

Validate an API key.

**Request:**

```json
{
  "key": "gk_..."
}
```

**Response:**

```json
{
  "valid": true,
  "keyId": "key-uuid",
  "tenantId": "tenant-uuid",
  "name": "Production API Key",
  "permissions": ["read", "write"]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {} // Optional additional details
}
```

### Common Error Codes

| Code               | HTTP Status | Description                       |
| ------------------ | ----------- | --------------------------------- |
| `UNAUTHORIZED`     | 401         | Missing or invalid authentication |
| `FORBIDDEN`        | 403         | Insufficient permissions          |
| `NOT_FOUND`        | 404         | Resource not found                |
| `CONFLICT`         | 409         | Resource already exists           |
| `INVALID_INPUT`    | 400         | Validation error                  |
| `VALIDATION_ERROR` | 400         | Zod validation failed             |
| `INTERNAL_ERROR`   | 500         | Server error                      |

### Example Error Response

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "code": "invalid_string",
      "message": "Invalid email format",
      "path": ["email"]
    }
  ]
}
```

---

## Rate Limiting

API keys and JWT tokens are subject to rate limiting:

- 1000 requests per minute for authenticated requests
- 100 requests per minute for unauthenticated requests

Rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1647072000
```

---

## Tenant Isolation

All resources are tenant-scoped. The `X-Tenant-ID` header is automatically set
by the authentication middleware. Cross-tenant access is not permitted.

---

## Health Check

### GET `/health`

Check server health.

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-03-12T08:00:00Z",
  "version": "0.0.1"
}
```
