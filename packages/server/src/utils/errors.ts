import { Context } from 'hono'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  // Support both (statusCode, code, message) and (message, statusCode) signatures
  constructor(statusCode: number, code: string, message: string, details?: any)
  constructor(message: string, statusCode: number, details?: any)
  constructor(
    statusCodeOrMessage: number | string,
    codeOrStatusCode: string | number,
    messageOrDetails?: string | any,
    details?: any,
  ) {
    // Determine which signature is being used
    if (typeof statusCodeOrMessage === 'string') {
      // (message, statusCode, details?) signature
      super(statusCodeOrMessage)
      this.statusCode = codeOrStatusCode as number
      this.code = 'INTERNAL_ERROR'
      this.details = messageOrDetails
    } else {
      // (statusCode, code, message, details?) signature
      super(messageOrDetails as string)
      this.statusCode = statusCodeOrMessage
      this.code = codeOrStatusCode as string
      this.details = details
    }
    this.name = 'ApiError'
  }
}

/**
 * Error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  GONE: 'GONE',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
} as const

/**
 * Create common errors
 */
export const errors = {
  unauthorized: (message = 'Unauthorized') => new ApiError(401, ErrorCodes.UNAUTHORIZED, message),

  forbidden: (message = 'Forbidden') => new ApiError(403, ErrorCodes.FORBIDDEN, message),

  notFound: (resource = 'Resource') =>
    new ApiError(404, ErrorCodes.NOT_FOUND, `${resource} not found`),

  conflict: (message = 'Resource already exists') =>
    new ApiError(409, ErrorCodes.CONFLICT, message),

  invalidInput: (details: any) =>
    new ApiError(400, ErrorCodes.INVALID_INPUT, 'Invalid input', details),

  internal: (message = 'Internal server error') =>
    new ApiError(500, ErrorCodes.INTERNAL_ERROR, message),
}

/**
 * Global error handler middleware
 */
export function errorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next()
    } catch (err) {
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
            error: ErrorCodes.VALIDATION_ERROR,
            message: 'Validation failed',
            details: err?.errors,
          },
          400,
        )
      }

      // Unknown errors
      console.error('Unhandled error:', err)
      return c.json(
        {
          error: ErrorCodes.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        500,
      )
    }
  }
}
