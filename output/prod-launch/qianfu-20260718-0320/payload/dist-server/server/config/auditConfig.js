// Audit configuration for permission changes
export const AUDIT_CONFIG = {
    // Audit log retention settings
    RETENTION: {
        ENABLED: true,
        MAX_DAYS: 365, // Retain for 365 days
        AUTO_CLEANUP: true,
        CLEANUP_INTERVAL_DAYS: 7 // Cleanup once a week
    },
    // Audit event types
    EVENTS: {
        // Permission change events
        PERMISSION_CHANGES: [
            'USER_ROLE_CHANGE',
            'PERMISSION_GROUP_ASSIGNED',
            'BATCH_PERMISSION_GROUP_ASSIGNED',
            'PERMISSION_UPDATE',
            'SYSTEM_ADMIN_SETUP'
        ],
        // Review related events
        REVIEW_ACTIONS: [
            'SERVER_REVIEWED',
            'BATCH_REVIEW_COMPLETED',
            'REVIEW_LIST_VIEWED',
            'REVIEW_HISTORY_VIEWED',
            'REVIEW_STATS_VIEWED'
        ],
        // System management events
        SYSTEM_MANAGEMENT: [
            'PORT5555_ACCESS_GRANTED',
            'PORT5555_ACCESS_DENIED',
            'PORT5555_STATS_VIEWED',
            'PERMISSION_GROUPS_VIEWED',
            'PERMISSION_HISTORY_VIEWED',
            'PERMISSION_STATS_VIEWED'
        ]
    },
    // Audit levels
    LEVELS: {
        INFO: 'INFO',
        WARNING: 'WARNING',
        ERROR: 'ERROR',
        CRITICAL: 'CRITICAL'
    },
    // Audit reporting settings
    REPORTING: {
        ENABLED: true,
        DAILY_SUMMARY: true,
        WEEKLY_REPORT: true,
        MONTHLY_REPORT: true,
        ALERT_THRESHOLDS: {
            HIGH_PRIVILEGE_CHANGES: 5, // More than 5 high privilege changes per day
            FAILED_ACCESS_ATTEMPTS: 10, // More than 10 failed access attempts per day
            BULK_OPERATIONS: 20 // More than 20 bulk operations per day
        }
    },
    // Security audit settings
    SECURITY: {
        DETECT_ANOMALIES: true,
        SUSPICIOUS_PATTERNS: [
            'RAPID_ROLE_CHANGES', // Rapid role changes
            'MULTIPLE_ADMIN_CREATIONS', // Multiple admin creations
            'UNUSUAL_ACCESS_TIMES', // Unusual access times
            'BULK_PERMISSION_MODIFICATIONS' // Bulk permission modifications
        ],
        ALERT_ADMIN_ON_ANOMALY: true
    }
};
// Audit analyzer class
export class AuditAnalyzer {
    // Detect anomaly patterns
    static detectAnomalies(events) {
        const anomalies = [];
        // Detect rapid role changes
        const rapidRoleChanges = this.detectRapidRoleChanges(events);
        if (rapidRoleChanges.count > 0) {
            anomalies.push(rapidRoleChanges);
        }
        // Detect unusual access times
        const unusualAccessTimes = this.detectUnusualAccessTimes(events);
        if (unusualAccessTimes.count > 0) {
            anomalies.push(unusualAccessTimes);
        }
        // Detect bulk permission modifications
        const bulkPermissionModifications = this.detectBulkPermissionModifications(events);
        if (bulkPermissionModifications.count > 0) {
            anomalies.push(bulkPermissionModifications);
        }
        return anomalies;
    }
    // Detect rapid role changes
    static detectRapidRoleChanges(events) {
        const roleChangeEvents = events.filter(event => AUDIT_CONFIG.EVENTS.PERMISSION_CHANGES.includes(event.action));
        // Group by user, detect multiple changes in short time
        const userChanges = new Map();
        roleChangeEvents.forEach(event => {
            const count = userChanges.get(event.user_id) || 0;
            userChanges.set(event.user_id, count + 1);
        });
        const rapidChanges = Array.from(userChanges.entries())
            .filter(([_, count]) => count > 3) // More than 3 role changes per day
            .length;
        return {
            type: 'RAPID_ROLE_CHANGES',
            description: 'Detected rapid changes in user roles',
            severity: rapidChanges > 5 ? 'HIGH' : 'MEDIUM',
            count: rapidChanges
        };
    }
    // Detect unusual access times
    static detectUnusualAccessTimes(events) {
        const unusualHours = events.filter(event => {
            const hour = event.timestamp.getHours();
            return hour < 6 || hour > 22; // Access between midnight and early morning
        }).length;
        return {
            type: 'UNUSUAL_ACCESS_TIMES',
            description: 'Detected access during unusual hours',
            severity: unusualHours > 10 ? 'MEDIUM' : 'LOW',
            count: unusualHours
        };
    }
    // Detect bulk permission modifications
    static detectBulkPermissionModifications(events) {
        const bulkOperations = events.filter(event => event.action === 'BATCH_PERMISSION_GROUP_ASSIGNED' ||
            event.action === 'BATCH_REVIEW_COMPLETED').length;
        return {
            type: 'BULK_PERMISSION_MODIFICATIONS',
            description: 'Detected bulk permission modification operations',
            severity: bulkOperations > 5 ? 'MEDIUM' : 'LOW',
            count: bulkOperations
        };
    }
    // Generate audit report
    static generateReport(events, startDate, endDate) {
        const periodEvents = events.filter(event => event.timestamp >= startDate && event.timestamp <= endDate);
        // Statistics by type
        const eventsByType = {};
        periodEvents.forEach(event => {
            eventsByType[event.action] = (eventsByType[event.action] || 0) + 1;
        });
        // Statistics by level
        const eventsByLevel = {};
        periodEvents.forEach(event => {
            eventsByLevel[event.level] = (eventsByLevel[event.level] || 0) + 1;
        });
        // Statistics for active users
        const userEvents = new Map();
        periodEvents.forEach(event => {
            const count = userEvents.get(event.user_id) || 0;
            userEvents.set(event.user_id, count + 1);
        });
        const topUsers = Array.from(userEvents.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([user_id, event_count]) => ({ user_id, event_count }));
        // Detect anomalies
        const anomalies = this.detectAnomalies(periodEvents);
        // Generate recommendations
        const recommendations = this.generateRecommendations(anomalies, eventsByType);
        return {
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            start_date: startDate,
            end_date: endDate,
            total_events: periodEvents.length,
            events_by_type: eventsByType,
            events_by_level: eventsByLevel,
            top_users: topUsers,
            anomalies: anomalies,
            recommendations: recommendations
        };
    }
    // Generate recommendations
    static generateRecommendations(anomalies, eventsByType) {
        const recommendations = [];
        // Generate recommendations based on anomalies
        anomalies.forEach(anomaly => {
            if (anomaly.severity === 'HIGH') {
                recommendations.push(`High risk anomaly detected: ${anomaly.type}, immediate investigation recommended`);
            }
            else if (anomaly.severity === 'MEDIUM') {
                recommendations.push(`Medium risk anomaly detected: ${anomaly.type}, investigation recommended`);
            }
        });
        // Generate recommendations based on event types
        if (eventsByType['PORT5555_ACCESS_DENIED'] > 10) {
            recommendations.push('Frequent Port 5555 access denials, check access control configuration');
        }
        if (eventsByType['BATCH_PERMISSION_GROUP_ASSIGNED'] > 5) {
            recommendations.push('Frequent bulk permission assignment operations, review permission management process');
        }
        return recommendations;
    }
}
//# sourceMappingURL=auditConfig.js.map