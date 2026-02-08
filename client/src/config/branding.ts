// client/src/config/branding.ts
// Centralized branding configuration
// These values can later be loaded from database via dashboard settings

export const SITE_NAME = "dahligarciamarquez";
export const SITE_VERSION = "1.0.2";

// Brand image slots - set URL to enable, leave empty string for placeholder
// Later: These will be fetched from system_settings table in Supabase
export const BRAND_IMAGES = {
  // Header/Navigation
  'header-logo': '',      // Main logo in navbar (recommended: wide rectangle, ~200x48px)
  
  // Footer
  'footer-logo': '',      // Logo in footer (can be same as header or variant)
  
  // Home page
  'hero-banner': '',  // Hero banner image on home page - now managed via Web UI wallpaper settings
  
  // About page
  'profile-image': '',    // Circular profile photo on About page (recommended: square, 200x200px+)
  
  // Metadata/Social
  'og-image': '',         // Open Graph image for social sharing (1200x630px recommended)
  'favicon': '',          // Browser favicon
} as const;

// Type helper for slot names
export type BrandImageSlot = keyof typeof BRAND_IMAGES;
