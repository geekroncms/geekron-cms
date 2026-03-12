# Backend Tests

This directory contains comprehensive unit tests for the Geekron CMS backend server.

## Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/users.test.ts

# Run tests matching a pattern
bun test --test-name-pattern="password"
```

## Test Files

### `users.test.ts`
Tests for user authentication and management:
- User registration
- User login
- Password hashing and verification
- JWT token validation
- User CRUD operations

### `api-keys.test.ts`
Tests for API key management:
- API key generation
- API key hashing
- Permission validation
- Expiration logic

### `collection-data.test.ts`
Tests for dynamic data operations:
- Data CRUD operations
- Query parameter validation
- Filter parsing
- Pagination logic
- JSON data handling

### `utils.test.ts`
Tests for utility functions:
- Error handling (ApiError class)
- Password hashing utilities
- Error factory functions

## Mocking

Tests use mock implementations for:
- D1 Database
- R2 Bucket storage
- JWT tokens

## Writing New Tests

When adding new features, follow this pattern:

```typescript
import { describe, test, expect } from 'bun:test';

describe('Feature Name', () => {
  describe('Specific Functionality', () => {
    test('should do something', async () => {
      // Arrange
      // Act
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Test Coverage Goals

- Authentication flows: 100%
- Error handling: 100%
- Core business logic: >80%
- API endpoints: >70%

## Continuous Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Before deployment

## Debugging Tests

```bash
# Run with verbose output
bun test --verbose

# Run with timeout increase for debugging
bun test --timeout=30000
```
