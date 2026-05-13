/**
 * Servers Controller - Unified Export
 *
 * This module re-exports all server-related controllers from sub-modules.
 * Original file: server/controllers/serversController.ts (1079 lines)
 * Split into: shared.ts, user.ts, list.ts, crud.ts, versions.ts, status.ts
 */

// User-related endpoints
export { getMe, listMyServers } from './user';

// Public listing
export { listAllServers } from './list';

// CRUD operations
export { createServer, updateServer, deleteServer } from './crud';

// Version control
export { getServer, listVersions, compareServerVersions, rollbackServer } from './versions';

// Status check
export { checkServerStatus } from './status';

// Re-export shared constants for convenience
export {
  PUBLIC_SERVERS_CACHE_PREFIX,
  PUBLIC_SERVERS_TTL,
  SERVER_SELECTION,
  SERVER_LIST_SELECTION,
  SERVER_ORDER_BY,
} from './shared';
