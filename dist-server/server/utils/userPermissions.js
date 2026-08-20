import { PERMISSION_GROUPS } from '../config/permissionGroups.js';
import { parseJsonArray } from './jsonField.js';
export const KNOWN_USER_PERMISSIONS = [
    'view_servers',
    'view_server_details',
    'search_servers',
    'publish_servers',
    'edit_own_servers',
    'delete_own_servers',
    'rate_servers',
    'comment_servers',
    'admin',
    'manage_users',
    'review_servers',
    'manage_content',
    'system_config',
    'manage_stats',
    'port5555_access',
    'sponsor_badge',
    'priority_support',
    'early_access',
    'level_trusted_member',
    'level_veteran',
    'level_elite',
];
const KNOWN_USER_PERMISSION_SET = new Set(KNOWN_USER_PERMISSIONS);
const ADMINISTRATIVE_ROLES = new Set(['OWNER', 'ADMIN', 'OPERATOR', 'SUPER_ADMIN']);
const SYSTEM_CONFIGURATION_ROLES = new Set(['OWNER', 'ADMIN', 'SUPER_ADMIN']);
const REVIEWER_ROLES = new Set(['OWNER', 'ADMIN', 'OPERATOR', 'SUPER_ADMIN', 'REVIEWER']);
const SUPPLEMENTAL_STORED_PERMISSIONS = new Set([
    'manage_stats',
    'port5555_access',
    'sponsor_badge',
    'priority_support',
    'early_access',
    'level_trusted_member',
    'level_veteran',
    'level_elite',
]);
const PRIVILEGED_PERMISSION_ROLES = {
    admin: ADMINISTRATIVE_ROLES,
    manage_users: ADMINISTRATIVE_ROLES,
    manage_content: ADMINISTRATIVE_ROLES,
    system_config: SYSTEM_CONFIGURATION_ROLES,
    review_servers: REVIEWER_ROLES,
    manage_stats: ADMINISTRATIVE_ROLES,
    port5555_access: ADMINISTRATIVE_ROLES,
};
export function isKnownUserPermission(value) {
    return typeof value === 'string' && KNOWN_USER_PERMISSION_SET.has(value);
}
export function isAdministrativeRole(role) {
    return typeof role === 'string' && ADMINISTRATIVE_ROLES.has(role.trim().toUpperCase());
}
function getRolePermissions(role) {
    const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : '';
    if (!Object.prototype.hasOwnProperty.call(PERMISSION_GROUPS, normalizedRole)) {
        return null;
    }
    return PERMISSION_GROUPS[normalizedRole].permissions;
}
function isPermissionAllowedForRole(permission, role) {
    const allowedRoles = PRIVILEGED_PERMISSION_ROLES[permission];
    return !allowedRoles || (typeof role === 'string' && allowedRoles.has(role.trim().toUpperCase()));
}
export function parseAuthorizedPermissions(value, role) {
    const storedPermissions = parseJsonArray(value).filter(isKnownUserPermission);
    const rolePermissions = getRolePermissions(role);
    const candidates = rolePermissions
        ? [
            ...rolePermissions,
            ...storedPermissions.filter((permission) => SUPPLEMENTAL_STORED_PERMISSIONS.has(permission)),
        ]
        : storedPermissions;
    return [...new Set(candidates)].filter((permission) => isPermissionAllowedForRole(permission, role));
}
export function hasAuthorizedPermission(role, storedPermissions, requiredPermission) {
    if (!isKnownUserPermission(requiredPermission)) {
        return false;
    }
    return parseAuthorizedPermissions(storedPermissions, role).includes(requiredPermission);
}
//# sourceMappingURL=userPermissions.js.map