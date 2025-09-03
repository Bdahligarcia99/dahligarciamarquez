// Runtime configuration state for the server
// This allows dynamic configuration changes without server restart

// Initialize from environment variable
let comingSoon = process.env.MAINTENANCE_MODE === 'true'

/**
 * Get the current Coming Soon mode state
 */
export function getComingSoon(): boolean {
  return comingSoon
}

/**
 * Set the Coming Soon mode state
 * @param value New Coming Soon state
 */
export function setComingSoon(value: boolean): void {
  comingSoon = value
  console.log(`Coming Soon mode ${value ? 'ENABLED' : 'DISABLED'}`)
}

/**
 * Get all runtime configuration (for debugging/health checks)
 */
export function getRuntimeConfig() {
  return {
    comingSoon,
    maintenanceMode: process.env.MAINTENANCE_MODE,
    timestamp: new Date().toISOString()
  }
}
