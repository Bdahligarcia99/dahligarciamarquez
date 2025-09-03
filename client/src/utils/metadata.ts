// client/src/utils/metadata.ts
import { SITE_NAME } from '../config/branding'

/**
 * Generate page title with optional custom title
 * @param title - Custom page title (optional)
 * @returns Formatted page title
 */
export function pageTitle(title?: string): string {
  return title ? `${title} – ${SITE_NAME}` : SITE_NAME
}

/**
 * Generate default metadata object for pages
 * @param title - Custom page title (optional)
 * @param description - Page description (optional)
 * @returns Metadata object with title, description, Open Graph, and Twitter data
 */
export function defaultMeta(title?: string, description?: string) {
  const computedTitle = pageTitle(title)
  const defaultDescription = `Personal stories and experiences from ${SITE_NAME}`
  const finalDescription = description || defaultDescription

  return {
    title: computedTitle,
    description: finalDescription,
    openGraph: {
      title: computedTitle,
      description: finalDescription,
      siteName: SITE_NAME,
      type: 'website'
    },
    twitter: {
      title: computedTitle,
      description: finalDescription,
      card: 'summary_large_image'
    }
  }
}

/**
 * Set document title (for client-side routing)
 * @param title - Custom page title (optional)
 */
export function setDocumentTitle(title?: string): void {
  document.title = pageTitle(title)
}

/**
 * Update meta description tag
 * @param description - Page description
 */
export function setMetaDescription(description: string): void {
  let metaDescription = document.querySelector('meta[name="description"]')
  
  if (!metaDescription) {
    metaDescription = document.createElement('meta')
    metaDescription.setAttribute('name', 'description')
    document.head.appendChild(metaDescription)
  }
  
  metaDescription.setAttribute('content', description)
}
