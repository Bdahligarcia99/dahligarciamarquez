// client/src/features/dashboard/types.js
// Type definitions for dashboard components

/**
 * @typedef {Object} Post
 * @property {number} id
 * @property {string} title
 * @property {string} body
 * @property {string} created_at
 * @property {'published'|'draft'} [status]
 */

/**
 * @typedef {Object} Health
 * @property {boolean} ok
 * @property {number} uptime
 */

/**
 * @typedef {Object} DbNow
 * @property {string} now
 */

export default {}
