// Permission groups configuration
export const PERMISSION_GROUPS = {
    // Basic registered user group
    NORMAL: {
        name: 'Normal User',
        description: 'Basic registered user permissions',
        permissions: [
            'view_servers',
            'view_server_details',
            'search_servers'
        ],
        server_limit: 0,
        can_publish: false,
        can_rate: false,
        can_review: false,
        color: 'hsl(var(--muted-foreground))',
        icon: 'User'
    },
    // Visitor group
    VISITOR: {
        name: 'Visitor',
        description: 'Basic access permissions',
        permissions: [
            'view_servers',
            'view_server_details',
            'search_servers'
        ],
        server_limit: 0,
        can_publish: false,
        can_rate: false,
        can_review: false,
        color: 'hsl(var(--muted-foreground))', // gray
        icon: 'User'
    },
    // Collaborator group
    COLLABORATOR: {
        name: 'Collaborator',
        description: 'Permissions for publishing servers',
        permissions: [
            'view_servers',
            'view_server_details',
            'search_servers',
            'publish_servers',
            'edit_own_servers',
            'delete_own_servers'
        ],
        server_limit: 5,
        can_publish: true,
        can_rate: false,
        can_review: false,
        color: 'hsl(var(--success))', // green
        icon: 'Handshake'
    },
    // Sponsor group
    SPONSOR: {
        name: 'Sponsor',
        description: 'Permissions for rating servers',
        permissions: [
            'view_servers',
            'view_server_details',
            'search_servers',
            'rate_servers',
            'comment_servers'
        ],
        server_limit: 0,
        can_publish: false,
        can_rate: true,
        can_review: false,
        color: 'hsl(var(--warning))', // amber
        icon: 'Star'
    },
    // Contributor group
    CONTRIBUTOR: {
        name: 'Contributor',
        description: 'Permissions for publishing up to 2 servers',
        permissions: [
            'view_servers',
            'view_server_details',
            'search_servers',
            'publish_servers',
            'edit_own_servers',
            'delete_own_servers',
            'rate_servers',
            'comment_servers'
        ],
        server_limit: 2,
        can_publish: true,
        can_rate: true,
        can_review: false,
        color: 'hsl(var(--primary))', // blue
        icon: 'Gem'
    },
    // Operator group
    OPERATOR: {
        name: 'Operator',
        description: 'Equivalent to administrator permissions',
        permissions: [
            'admin',
            'manage_users',
            'review_servers',
            'manage_content',
            'view_servers',
            'view_server_details',
            'search_servers',
            'publish_servers',
            'edit_own_servers',
            'delete_own_servers',
            'rate_servers',
            'comment_servers'
        ],
        server_limit: 999,
        can_publish: true,
        can_rate: true,
        can_review: true,
        color: 'hsl(var(--accent))', // violet
        icon: 'Settings'
    },
    // Administrator group
    ADMIN: {
        name: 'Administrator',
        description: 'Highest system permissions',
        permissions: [
            'admin',
            'manage_users',
            'review_servers',
            'manage_content',
            'system_config',
            'view_servers',
            'view_server_details',
            'search_servers',
            'publish_servers',
            'edit_own_servers',
            'delete_own_servers',
            'rate_servers',
            'comment_servers'
        ],
        server_limit: 999,
        can_publish: true,
        can_rate: true,
        can_review: true,
        color: 'hsl(var(--destructive))', // red
        icon: 'Crown'
    }
};
// Permission group weights (for hierarchy comparison)
const GROUP_WEIGHTS = {
    VISITOR: 10,
    NORMAL: 15,
    SPONSOR: 20,
    COLLABORATOR: 30,
    CONTRIBUTOR: 40,
    OPERATOR: 80,
    ADMIN: 100
};
// Permission group management functions
export class PermissionGroupManager {
    // Get all permission groups
    static getAllGroups() {
        return PERMISSION_GROUPS;
    }
    // Get specific permission group
    static getGroup(group) {
        return PERMISSION_GROUPS[group];
    }
    // Check hierarchy (if assigner power is higher or equal to target)
    static hasHigherOrEqualPower(assignerRole, targetRole) {
        return GROUP_WEIGHTS[assignerRole] >= GROUP_WEIGHTS[targetRole];
    }
    // Check if user has specific permission
    static hasPermission(userPermissions, requiredPermission, isAdmin = false) {
        if (isAdmin)
            return true;
        return userPermissions.includes(requiredPermission);
    }
    // Check if user can perform specific action
    static canPerformAction(userPermissions, action, isAdmin = false) {
        if (isAdmin)
            return true;
        const actionPermissions = {
            'publish_server': 'publish_servers',
            'edit_server': 'edit_own_servers',
            'delete_server': 'delete_own_servers',
            'rate_server': 'rate_servers',
            'comment_server': 'comment_servers',
            'review_server': 'review_servers',
            'manage_users': 'manage_users',
            'manage_content': 'manage_content',
            'system_config': 'system_config'
        };
        const requiredPermission = actionPermissions[action];
        return requiredPermission ? this.hasPermission(userPermissions, requiredPermission) : false;
    }
    // Get assignable groups for an administrator
    static getAssignableGroups(assignerPermissions, assignerRole) {
        const groups = Object.keys(PERMISSION_GROUPS);
        // Only users with management permissions can assign groups
        if (!this.hasPermission(assignerPermissions, 'manage_users')) {
            return [];
        }
        // Can only assign groups with lower or equal weight
        return groups.filter(group => GROUP_WEIGHTS[assignerRole] >= GROUP_WEIGHTS[group]);
    }
    // Validate if group assignment is valid
    static validateGroupAssignment(targetUserCurrentGroup, newGroup, assignerPermissions, assignerRole = 'VISITOR', // Default to visitor
    isAssignerAdmin = false) {
        // Check if assigner has required permissions
        if (!this.hasPermission(assignerPermissions, 'manage_users', isAssignerAdmin)) {
            return { valid: false, message: 'Insufficient permissions to assign group' };
        }
        // Check if target group exists
        if (!PERMISSION_GROUPS[newGroup]) {
            return { valid: false, message: 'Target permission group does not exist' };
        }
        // Check if current role exists
        if (!PERMISSION_GROUPS[targetUserCurrentGroup]) {
            return { valid: false, message: 'User current role is invalid' };
        }
        // Security check: cannot modify permissions of users with higher hierarchy
        if (!isAssignerAdmin && GROUP_WEIGHTS[assignerRole] < GROUP_WEIGHTS[targetUserCurrentGroup] && assignerRole !== 'ADMIN') {
            return { valid: false, message: 'Insufficient permissions to modify higher level user' };
        }
        // Security check: cannot promote user to a higher hierarchy than oneself
        if (!isAssignerAdmin && GROUP_WEIGHTS[assignerRole] < GROUP_WEIGHTS[newGroup] && assignerRole !== 'ADMIN') {
            return { valid: false, message: 'Insufficient permissions to assign higher level group' };
        }
        // Admin can only be assigned by other admins
        if (newGroup === 'ADMIN' && !this.hasPermission(assignerPermissions, 'admin', isAssignerAdmin)) {
            return { valid: false, message: 'Only administrators can assign administrator role' };
        }
        return { valid: true };
    }
}
// Default permission group
export const DEFAULT_PERMISSION_GROUP = 'NORMAL';
// Default permissions for new users
export const getDefaultPermissions = () => {
    return [...PERMISSION_GROUPS[DEFAULT_PERMISSION_GROUP].permissions];
};
//# sourceMappingURL=permissionGroups.js.map