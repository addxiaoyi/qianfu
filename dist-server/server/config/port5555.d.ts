import type { UserRole, Permission } from '../types/roles';
export declare const PORT_5555_CONFIG: {
    PORT: number;
    ALLOWED_ROLES: UserRole[];
    REQUIRED_PERMISSIONS: Permission[];
    ACCESS_CONTROL: {
        MAX_CONCURRENT_CONNECTIONS: number;
        RATE_LIMIT: {
            windowMs: number;
            max: number;
            message: string;
        };
        IP_WHITELIST: string[];
        SESSION_TIMEOUT: number;
        ENABLE_2FA: boolean;
        LOG_RETENTION_DAYS: number;
    };
    SECURITY: {
        FORCE_HTTPS: boolean;
        ENABLE_CSRF: boolean;
        ENABLE_CSP: boolean;
        ENABLE_XSS_PROTECTION: boolean;
        ENABLE_HSTS: boolean;
    };
    ERROR_HANDLING: {
        SHOW_DETAILED_ERRORS: boolean;
        ERROR_PAGE_PATH: string;
        LOG_ERRORS: boolean;
    };
};
export declare const validatePort5555Access: (userRole: UserRole, userPermissions: Permission[]) => boolean;
export declare const getPort5555AccessInfo: (userRole: UserRole, userPermissions: Permission[]) => {
    hasAccess: boolean;
    allowedRoles: string[];
    userRole: string;
    userPermissions: string[];
    missingRequirements: {
        roles: string[];
    };
};
export interface Port5555AccessLog {
    id?: number;
    userId: number;
    username: string;
    userRole: UserRole;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    action: 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'SESSION_EXPIRED' | 'RATE_LIMIT_EXCEEDED';
    path: string;
    method: string;
    statusCode: number;
    errorMessage?: string;
    sessionId?: string;
}
export interface Port5555AccessStats {
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    uniqueUsers: number;
    averageAccessTime: number;
    lastAccess: Date;
    topAccessPaths: Array<{
        path: string;
        count: number;
    }>;
    accessByRole: Record<UserRole, number>;
}
//# sourceMappingURL=port5555.d.ts.map