/**
 * Canonical API prefix/version constants.
 * Keep all route-prefix configuration in one place.
 */
export declare const API_PREFIX: "/api";
export declare const API_DEFAULT_VERSION: "v1";
export declare const API_VERSION_PREFIX: "/api/v1";
/**
 * Supported public API versions.
 * When adding a new version, update this list and apiVersioning config together.
 */
export declare const SUPPORTED_API_VERSIONS: readonly ["v1"];
/**
 * Non-versioned operational endpoints.
 * These are intentionally kept stable for infra probes and diagnostics.
 */
export declare const NON_VERSIONED_API_PATHS: readonly ["/api/health", "/api/ready", "/api/health/detailed", "/api/auth/oauth-status", "/api/test-mcstatus-direct", "/health"];
//# sourceMappingURL=api.d.ts.map