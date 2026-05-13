/**
 * Canonical API prefix/version constants.
 * Keep all route-prefix configuration in one place.
 */
export const API_PREFIX = '/api' as const;
export const API_DEFAULT_VERSION = 'v1' as const;
export const API_VERSION_PREFIX = `${API_PREFIX}/${API_DEFAULT_VERSION}` as const;

/**
 * Supported public API versions.
 * When adding a new version, update this list and apiVersioning config together.
 */
export const SUPPORTED_API_VERSIONS = ['v1'] as const;

/**
 * Non-versioned operational endpoints.
 * These are intentionally kept stable for infra probes and diagnostics.
 */
export const NON_VERSIONED_API_PATHS = [
  `${API_PREFIX}/health`,
  `${API_PREFIX}/ready`,
  `${API_PREFIX}/health/detailed`,
  `${API_PREFIX}/auth/oauth-status`,
  `${API_PREFIX}/test-mcstatus-direct`,
  '/health',
] as const;
