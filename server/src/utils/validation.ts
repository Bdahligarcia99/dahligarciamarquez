/**
 * Validation error structure
 */
export interface ValidationError {
  field: string
  message: string
  code: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Post validation constraints
 */
export const POST_CONSTRAINTS = {
  title: {
    minLength: 1,
    maxLength: 120
  },
  excerpt: {
    maxLength: 500
  },
  slug: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  }
} as const

/**
 * Validates a post title
 */
export function validateTitle(title: any): ValidationError[] {
  const errors: ValidationError[] = []

  if (!title) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      code: 'REQUIRED'
    })
    return errors
  }

  if (typeof title !== 'string') {
    errors.push({
      field: 'title',
      message: 'Title must be a string',
      code: 'INVALID_TYPE'
    })
    return errors
  }

  const trimmedTitle = title.trim()

  if (trimmedTitle.length === 0) {
    errors.push({
      field: 'title',
      message: 'Title cannot be empty',
      code: 'EMPTY'
    })
  }

  if (trimmedTitle.length > POST_CONSTRAINTS.title.maxLength) {
    errors.push({
      field: 'title',
      message: `Title must be ${POST_CONSTRAINTS.title.maxLength} characters or less`,
      code: 'TOO_LONG'
    })
  }

  return errors
}

/**
 * Validates a post excerpt
 */
export function validateExcerpt(excerpt: any): ValidationError[] {
  const errors: ValidationError[] = []

  // Excerpt is optional
  if (excerpt === null || excerpt === undefined) {
    return errors
  }

  if (typeof excerpt !== 'string') {
    errors.push({
      field: 'excerpt',
      message: 'Excerpt must be a string',
      code: 'INVALID_TYPE'
    })
    return errors
  }

  const trimmedExcerpt = excerpt.trim()

  if (trimmedExcerpt.length > POST_CONSTRAINTS.excerpt.maxLength) {
    errors.push({
      field: 'excerpt',
      message: `Excerpt must be ${POST_CONSTRAINTS.excerpt.maxLength} characters or less`,
      code: 'TOO_LONG'
    })
  }

  return errors
}

/**
 * Validates a post slug format
 */
export function validateSlugFormat(slug: any): ValidationError[] {
  const errors: ValidationError[] = []

  if (!slug) {
    errors.push({
      field: 'slug',
      message: 'Slug is required',
      code: 'REQUIRED'
    })
    return errors
  }

  if (typeof slug !== 'string') {
    errors.push({
      field: 'slug',
      message: 'Slug must be a string',
      code: 'INVALID_TYPE'
    })
    return errors
  }

  const trimmedSlug = slug.trim()

  if (trimmedSlug.length === 0) {
    errors.push({
      field: 'slug',
      message: 'Slug cannot be empty',
      code: 'EMPTY'
    })
  }

  if (trimmedSlug.length > POST_CONSTRAINTS.slug.maxLength) {
    errors.push({
      field: 'slug',
      message: `Slug must be ${POST_CONSTRAINTS.slug.maxLength} characters or less`,
      code: 'TOO_LONG'
    })
  }

  if (!POST_CONSTRAINTS.slug.pattern.test(trimmedSlug)) {
    errors.push({
      field: 'slug',
      message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      code: 'INVALID_FORMAT'
    })
  }

  return errors
}

/**
 * Validates post status
 */
export function validateStatus(status: any): ValidationError[] {
  const errors: ValidationError[] = []
  const validStatuses = ['draft', 'published', 'private', 'system', 'archived']

  if (status !== undefined && !validStatuses.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
      code: 'INVALID_VALUE'
    })
  }

  return errors
}

/**
 * Validates rich content
 */
export function validateRichContent(contentRich: any): ValidationError[] {
  const errors: ValidationError[] = []

  if (!contentRich) {
    errors.push({
      field: 'content_rich',
      message: 'Content is required',
      code: 'REQUIRED'
    })
    return errors
  }

  // Basic check that it's an object (ProseMirror JSON structure)
  if (typeof contentRich !== 'object' || Array.isArray(contentRich)) {
    errors.push({
      field: 'content_rich',
      message: 'Content must be a valid rich text object',
      code: 'INVALID_TYPE'
    })
  }

  return errors
}

/**
 * Creates a 422 validation error response
 */
export function createValidationErrorResponse(errors: ValidationError[]) {
  const errorMap: Record<string, string[]> = {}
  
  for (const error of errors) {
    if (!errorMap[error.field]) {
      errorMap[error.field] = []
    }
    errorMap[error.field].push(error.message)
  }

  return {
    error: 'Validation failed',
    fields: errorMap
  }
}
