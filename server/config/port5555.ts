import type { UserRole, Permission } from '../types/roles';

// Port 5555 access permission configuration
export const PORT_5555_CONFIG = {
  // Port number
  PORT: 5555,
  
  // Allowed roles for access
  ALLOWED_ROLES: ['ADMIN', 'OPERATOR'] as UserRole[],
  
  // Required permissions
  REQUIRED_PERMISSIONS: ['port5555_access'] as Permission[],
  
  // Access control strategy
  ACCESS_CONTROL: {
    // Maximum concurrent connections
    MAX_CONCURRENT_CONNECTIONS: 10,
    
    // Request rate limit (per minute)
    RATE_LIMIT: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // Max 100 requests
      message: 'Too many requests, please try again later'
    },
    
    // IP whitelist (optional)
    IP_WHITELIST: [] as string[],
    
    // Session timeout (milliseconds)
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    
    // Whether to enable two-factor authentication
    ENABLE_2FA: true,
    
    // Access log retention days
    LOG_RETENTION_DAYS: 90
  },
  
  // Security configuration
  SECURITY: {
    // Whether to enable HTTPS redirection
    FORCE_HTTPS: process.env.NODE_ENV === 'production',
    
    // Whether to enable CSRF protection
    ENABLE_CSRF: true,
    
    // Whether to enable content security policy
    ENABLE_CSP: true,
    
    // Whether to enable XSS protection
    ENABLE_XSS_PROTECTION: true,
    
    // Whether to enable HSTS
    ENABLE_HSTS: process.env.NODE_ENV === 'production'
  },
  
  // Error handling configuration
  ERROR_HANDLING: {
    // Whether to show detailed error information
    SHOW_DETAILED_ERRORS: process.env.NODE_ENV === 'development',
    
    // Custom error page path
    ERROR_PAGE_PATH: '/errors/port5555.html',
    
    // Whether to log errors
    LOG_ERRORS: true
  }
};

// Port 5555 access validation function
export const validatePort5555Access = (userRole: UserRole, userPermissions: Permission[]): boolean => {
  const hasPermission = PORT_5555_CONFIG.REQUIRED_PERMISSIONS.some(p => userPermissions.includes(p));
  const hasRoleAccess = PORT_5555_CONFIG.ALLOWED_ROLES.includes(userRole);
  return hasPermission || hasRoleAccess;
};

// Get access permission information
export const getPort5555AccessInfo = (userRole: UserRole, userPermissions: Permission[]) => {
  const hasAccess = validatePort5555Access(userRole, userPermissions);
  
  return {
    hasAccess,
    allowedRoles: PORT_5555_CONFIG.ALLOWED_ROLES,
    userRole,
    userPermissions,
    missingRequirements: {
      roles: PORT_5555_CONFIG.ALLOWED_ROLES.filter(role => role !== userRole)
    }
  };
};

// Port 5555 access log interface
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

// Access statistics information
export interface Port5555AccessStats {
  totalAccesses: number;
  successfulAccesses: number;
  failedAccesses: number;
  uniqueUsers: number;
  averageAccessTime: number;
  lastAccess: Date;
  topAccessPaths: Array<{ path: string; count: number }>;
  accessByRole: Record<UserRole, number>;
}
