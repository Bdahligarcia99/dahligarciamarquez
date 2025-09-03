/**
 * Image validation utilities
 */

export interface ImageValidationError {
  field: string
  message: string
  code: string
}

/**
 * Image validation constraints
 */
export const IMAGE_CONSTRAINTS = {
  alt_text: {
    required: true,
    minLength: 1,
    maxLength: 500
  },
  title: {
    required: false,
    maxLength: 120
  }
} as const

/**
 * Validates image alt_text
 */
export function validateAltText(altText: any): ImageValidationError[] {
  const errors: ImageValidationError[] = []

  if (!altText) {
    errors.push({
      field: 'alt_text',
      message: 'Alt text is required for accessibility',
      code: 'REQUIRED'
    })
    return errors
  }

  if (typeof altText !== 'string') {
    errors.push({
      field: 'alt_text',
      message: 'Alt text must be a string',
      code: 'INVALID_TYPE'
    })
    return errors
  }

  const trimmedAltText = altText.trim()

  if (trimmedAltText.length === 0) {
    errors.push({
      field: 'alt_text',
      message: 'Alt text cannot be empty',
      code: 'EMPTY'
    })
  }

  if (trimmedAltText.length > IMAGE_CONSTRAINTS.alt_text.maxLength) {
    errors.push({
      field: 'alt_text',
      message: `Alt text must be ${IMAGE_CONSTRAINTS.alt_text.maxLength} characters or less`,
      code: 'TOO_LONG'
    })
  }

  return errors
}

/**
 * Validates image title
 */
export function validateImageTitle(title: any): ImageValidationError[] {
  const errors: ImageValidationError[] = []

  // Title is optional
  if (title === null || title === undefined) {
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

  if (trimmedTitle.length > IMAGE_CONSTRAINTS.title.maxLength) {
    errors.push({
      field: 'title',
      message: `Title must be ${IMAGE_CONSTRAINTS.title.maxLength} characters or less`,
      code: 'TOO_LONG'
    })
  }

  return errors
}

/**
 * Creates a 422 validation error response for images
 */
export function createImageValidationErrorResponse(errors: ImageValidationError[]) {
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
