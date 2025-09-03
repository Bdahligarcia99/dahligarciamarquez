import { supabaseAdmin } from '../../auth/supabaseAdmin.js'

// Reserved words that cannot be used as slugs
const RESERVED_WORDS = [
  'new', 'admin', 'edit', 'create', 'update', 'delete', 'api',
  'posts', 'images', 'labels', 'auth', 'login', 'logout', 'register',
  'dashboard', 'settings', 'profile', 'search', 'about', 'contact',
  'help', 'terms', 'privacy', 'blog', 'stories'
]

/**
 * Transliterates and normalizes text for URL-safe slugs
 */
function transliterate(text: string): string {
  return text
    // Convert to lowercase
    .toLowerCase()
    // Replace accented characters with basic equivalents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace non-alphanumeric characters with spaces
    .replace(/[^a-z0-9\s-]/g, ' ')
    // Replace multiple spaces/dashes with single dash
    .replace(/[\s-]+/g, '-')
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, '')
}

/**
 * Generates a unique slug from a title
 */
export async function slugify(title: string, excludeId?: string): Promise<string> {
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required for slug generation')
  }

  const baseSlug = transliterate(title.trim())
  
  if (!baseSlug) {
    throw new Error('Title must contain at least one alphanumeric character')
  }

  // Check if it's a reserved word
  if (RESERVED_WORDS.includes(baseSlug)) {
    throw new Error(`"${baseSlug}" is a reserved word and cannot be used as a slug`)
  }

  // Check uniqueness and deduplicate if needed
  let finalSlug = baseSlug
  let counter = 1

  while (await isSlugTaken(finalSlug, excludeId)) {
    counter++
    finalSlug = `${baseSlug}-${counter}`
  }

  return finalSlug
}

/**
 * Validates if a slug is available
 */
export async function validateSlugAvailability(slug: string, excludeId?: string): Promise<boolean> {
  if (!slug || typeof slug !== 'string') {
    return false
  }

  // Check format
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugPattern.test(slug)) {
    return false
  }

  // Check reserved words
  if (RESERVED_WORDS.includes(slug)) {
    return false
  }

  // Check uniqueness
  return !(await isSlugTaken(slug, excludeId))
}

/**
 * Checks if a slug is already taken in the database
 */
async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabaseAdmin
      .from('posts')
      .select('id')
      .eq('slug', slug)

    // Exclude current post when updating
    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.single()

    if (error) {
      // PGRST116 means no rows found, which is what we want
      return error.code !== 'PGRST116'
    }

    // If we got data, the slug is taken
    return !!data
  } catch (error) {
    console.error('Error checking slug availability:', error)
    // On error, assume it's taken to be safe
    return true
  }
}

/**
 * Gets reserved words list for validation
 */
export function getReservedWords(): string[] {
  return [...RESERVED_WORDS]
}
