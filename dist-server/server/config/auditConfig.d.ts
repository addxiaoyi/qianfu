export declare const AUDIT_CONFIG: {
    RETENTION: {
        ENABLED: boolean;
        MAX_DAYS: number;
        AUTO_CLEANUP: boolean;
        CLEANUP_INTERVAL_DAYS: number;
    };
    EVENTS: {
        PERMISSION_CHANGES: string[];
        REVIEW_ACTIONS: string[];
        SYSTEM_MANAGEMENT: string[];
    };
    LEVELS: {
        INFO: string;
        WARNING: string;
        ERROR: string;
        CRITICAL: string;
    };
    REPORTING: {
        ENABLED: boolean;
        DAILY_SUMMARY: boolean;
        WEEKLY_REPORT: boolean;
        MONTHLY_REPORT: boolean;
        ALERT_THRESHOLDS: {
            HIGH_PRIVILEGE_CHANGES: number;
            FAILED_ACCESS_ATTEMPTS: number;
            BULK_OPERATIONS: number;
        };
    };
    SECURITY: {
        DETECT_ANOMALIES: boolean;
        SUSPICIOUS_PATTERNS: string[];
        ALERT_ADMIN_ON_ANOMALY: boolean;
    };
};
export interface AuditEvent {
    id?: number;
    user_id: number;
    action: string;
    target: string;
    level: string;
    ip: string;
    user_agent?: string;
    details: any;
    timestamp: Date;
}
export interface AuditReport {
    period: string;
    start_date: Date;
    end_date: Date;
    total_events: number;
    events_by_type: Record<string, number>;
    events_by_level: Record<string, number>;
    top_users: Array<{
        user_id: number;
        event_count: number;
        username?: string;
    }>;
    anomalies: Array<{
        type: string;
        description: string;
        severity: string;
        count: number;
    }>;
    recommendations: string[];
}
export declare class AuditAnalyzer {
    static detectAnomalies(events: AuditEvent[]): Array<{
        type: string;
        description: string;
        severity: string;
        count: number;
    }>;
    private static detectRapidRoleChanges;
    private static detectUnusualAccessTimes;
    private static detectBulkPermissionModifications;
    static generateReport(events: AuditEvent[], startDate: Date, endDate: Date): AuditReport;
    private static generateRecommendations;
}
//# sourceMappingURL=auditConfig.d.ts.map