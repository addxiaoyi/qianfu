export declare const PERMISSION_GROUPS: {
    readonly NORMAL: {
        readonly name: "Normal User";
        readonly description: "Basic registered user permissions";
        readonly permissions: readonly ["view_servers", "view_server_details", "search_servers"];
        readonly server_limit: 0;
        readonly can_publish: false;
        readonly can_rate: false;
        readonly can_review: false;
        readonly color: "hsl(var(--muted-foreground))";
        readonly icon: "User";
    };
    readonly VISITOR: {
        readonly name: "Visitor";
        readonly description: "Basic access permissions";
        readonly permissions: readonly ["view_servers", "view_server_details", "search_servers"];
        readonly server_limit: 0;
        readonly can_publish: false;
        readonly can_rate: false;
        readonly can_review: false;
        readonly color: "hsl(var(--muted-foreground))";
        readonly icon: "User";
    };
    readonly COLLABORATOR: {
        readonly name: "Collaborator";
        readonly description: "Permissions for publishing servers";
        readonly permissions: readonly ["view_servers", "view_server_details", "search_servers", "publish_servers", "edit_own_servers", "delete_own_servers"];
        readonly server_limit: 5;
        readonly can_publish: true;
        readonly can_rate: false;
        readonly can_review: false;
        readonly color: "hsl(var(--success))";
        readonly icon: "Handshake";
    };
    readonly SPONSOR: {
        readonly name: "Sponsor";
        readonly description: "Permissions for rating servers";
        readonly permissions: readonly ["view_servers", "view_server_details", "search_servers", "rate_servers", "comment_servers"];
        readonly server_limit: 0;
        readonly can_publish: false;
        readonly can_rate: true;
        readonly can_review: false;
        readonly color: "hsl(var(--warning))";
        readonly icon: "Star";
    };
    readonly CONTRIBUTOR: {
        readonly name: "Contributor";
        readonly description: "Permissions for publishing up to 2 servers";
        readonly permissions: readonly ["view_servers", "view_server_details", "search_servers", "publish_servers", "edit_own_servers", "delete_own_servers", "rate_servers", "comment_servers"];
        readonly server_limit: 2;
        readonly can_publish: true;
        readonly can_rate: true;
        readonly can_review: false;
        readonly color: "hsl(var(--primary))";
        readonly icon: "Gem";
    };
    readonly OPERATOR: {
        readonly name: "Operator";
        readonly description: "Equivalent to administrator permissions";
        readonly permissions: readonly ["admin", "manage_users", "review_servers", "manage_content", "view_servers", "view_server_details", "search_servers", "publish_servers", "edit_own_servers", "delete_own_servers", "rate_servers", "comment_servers"];
        readonly server_limit: 999;
        readonly can_publish: true;
        readonly can_rate: true;
        readonly can_review: true;
        readonly color: "hsl(var(--accent))";
        readonly icon: "Settings";
    };
    readonly ADMIN: {
        readonly name: "Administrator";
        readonly description: "Highest system permissions";
        readonly permissions: readonly ["admin", "manage_users", "review_servers", "manage_content", "system_config", "view_servers", "view_server_details", "search_servers", "publish_servers", "edit_own_servers", "delete_own_servers", "rate_servers", "comment_servers"];
        readonly server_limit: 999;
        readonly can_publish: true;
        readonly can_rate: true;
        readonly can_review: true;
        readonly color: "hsl(var(--destructive))";
        readonly icon: "Crown";
    };
};
export type PermissionGroup = keyof typeof PERMISSION_GROUPS;
export interface PermissionGroupInfo {
    name: string;
    description: string;
    permissions: readonly string[];
    server_limit: number;
    can_publish: boolean;
    can_rate: boolean;
    can_review: boolean;
    color: string;
    icon: string;
}
export interface UserPermissionGroup {
    userId: number;
    group: PermissionGroup;
    assignedBy: number;
    assignedAt: Date;
    expiresAt?: Date;
}
export declare class PermissionGroupManager {
    static getAllGroups(): Record<string, PermissionGroupInfo>;
    static getGroup(group: PermissionGroup): PermissionGroupInfo;
    static hasHigherOrEqualPower(assignerRole: PermissionGroup, targetRole: PermissionGroup): boolean;
    static hasPermission(userPermissions: readonly string[], requiredPermission: string, isAdmin?: boolean): boolean;
    static canPerformAction(userPermissions: readonly string[], action: string, isAdmin?: boolean): boolean;
    static getAssignableGroups(assignerPermissions: string[], assignerRole: PermissionGroup): PermissionGroup[];
    static validateGroupAssignment(targetUserCurrentGroup: PermissionGroup, newGroup: PermissionGroup, assignerPermissions: string[], assignerRole?: PermissionGroup, // Default to visitor
    isAssignerAdmin?: boolean): {
        valid: boolean;
        message?: string;
    };
}
export declare const DEFAULT_PERMISSION_GROUP: PermissionGroup;
export declare const getDefaultPermissions: () => string[];
//# sourceMappingURL=permissionGroups.d.ts.map