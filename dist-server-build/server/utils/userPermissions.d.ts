export declare const KNOWN_USER_PERMISSIONS: readonly ["view_servers", "view_server_details", "search_servers", "publish_servers", "edit_own_servers", "delete_own_servers", "rate_servers", "comment_servers", "admin", "manage_users", "review_servers", "manage_content", "system_config", "manage_stats", "port5555_access", "sponsor_badge", "priority_support", "early_access", "level_trusted_member", "level_veteran", "level_elite"];
export type KnownUserPermission = (typeof KNOWN_USER_PERMISSIONS)[number];
export declare function isKnownUserPermission(value: unknown): value is KnownUserPermission;
export declare function isAdministrativeRole(role: unknown): boolean;
export declare function parseAuthorizedPermissions(value: unknown, role: unknown): KnownUserPermission[];
export declare function hasAuthorizedPermission(role: unknown, storedPermissions: unknown, requiredPermission: string): boolean;
//# sourceMappingURL=userPermissions.d.ts.map