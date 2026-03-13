import { describe, expect, test } from 'bun:test'

describe('Error Handling Utils', () => {
  describe('ApiError Class', () => {
    test('should create ApiError with correct properties', async () => {
      const { ApiError } = await import('../src/utils/errors')

      const error = new ApiError(404, 'NOT_FOUND', 'Resource not found', { id: '123' })

      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('Resource not found')
      expect(error.details).toEqual({ id: '123' })
      expect(error.name).toBe('ApiError')
    })

    test('should create ApiError without details', async () => {
      const { ApiError } = await import('../src/utils/errors')

      const error = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong')

      expect(error.statusCode).toBe(500)
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.message).toBe('Something went wrong')
      expect(error.details).toBeUndefined()
    })
  })

  describe('Error Factory Functions', () => {
    test('should create unauthorized error', async () => {
      const { errors } = await import('../src/utils/errors')

      const error = errors.unauthorized('Custom message')

      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.message).toBe('Custom message')
    })

    test('should create not found error with default message', async () => {
      const { errors } = await import('../src/utils/errors')

      const error = errors.notFound()

      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('Resource not found')
    })

    test('should create not found error with custom resource', async () => {
      const { errors } = await import('../src/utils/errors')

      const error = errors.notFound('User')

      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('User not found')
    })

    test('should create conflict error', async () => {
      const { errors } = await import('../src/utils/errors')

      const error = errors.conflict('Email already exists')

      expect(error.statusCode).toBe(409)
      expect(error.code).toBe('CONFLICT')
      expect(error.message).toBe('Email already exists')
    })

    test('should create invalid input error with details', async () => {
      const { errors } = await import('../src/utils/errors')

      const error = errors.invalidInput({ email: 'Invalid format' })

      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.message).toBe('Invalid input')
      expect(error.details).toEqual({ email: 'Invalid format' })
    })
  })

  describe('Error Codes', () => {
    test('should have all expected error codes', async () => {
      const { ErrorCodes } = await import('../src/utils/errors')

      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT')
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    })
  })
})

describe('Password Utils', () => {
  test('should hash and verify password', async () => {
    const { hashPassword, comparePassword } = await import('../src/utils/password')

    const password = 'SecurePassword123!'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(await comparePassword(password, hash)).toBe(true)
    expect(await comparePassword('WrongPassword', hash)).toBe(false)
  })

  test('should handle unicode passwords', async () => {
    const { hashPassword, comparePassword } = await import('../src/utils/password')

    const password = '密码 123!🚀'
    const hash = await hashPassword(password)

    expect(await comparePassword(password, hash)).toBe(true)
    expect(await comparePassword('密码 123!', hash)).toBe(false)
  })

  test('should handle very long passwords', async () => {
    const { hashPassword, comparePassword } = await import('../src/utils/password')

    const password = 'a'.repeat(1000)
    const hash = await hashPassword(password)

    expect(await comparePassword(password, hash)).toBe(true)
  })
})
