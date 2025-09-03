/**
 * Centralized response utilities for consistent API responses
 */

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string
  details?: any
}

/**
 * Standard validation error response format
 */
export interface ValidationErrorResponse {
  error: string
  fields: Record<string, string[]>
}

/**
 * Standard list response format
 */
export interface ListResponse<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

/**
 * Standard single item response format
 */
export interface SingleResponse<T> {
  [key: string]: T
}

/**
 * Warning response format (for file uploads)
 */
export interface WarningResponse<T> extends SingleResponse<T> {
  warning: true
  message: string
}

/**
 * Creates a standard error response
 */
export function createErrorResponse(error: string, details?: any): ErrorResponse {
  const response: ErrorResponse = { error }
  if (details !== undefined) {
    response.details = details
  }
  return response
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(fields: Record<string, string[]>): ValidationErrorResponse {
  return {
    error: 'Validation failed',
    fields
  }
}

/**
 * Creates a list response
 */
export function createListResponse<T>(
  items: T[], 
  page: number, 
  limit: number, 
  total: number
): ListResponse<T> {
  return {
    items,
    page,
    limit,
    total
  }
}

/**
 * Creates a single item response
 */
export function createSingleResponse<T>(key: string, item: T): SingleResponse<T> {
  return {
    [key]: item
  } as SingleResponse<T>
}

/**
 * Creates a warning response for file uploads
 */
export function createWarningResponse<T>(
  key: string, 
  item: T, 
  message: string
): WarningResponse<T> {
  return {
    [key]: item,
    warning: true,
    message
  } as WarningResponse<T>
}

/**
 * Standard HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
} as const
