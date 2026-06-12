export declare const AUDIT_ALERT_LEVELS: {
    readonly WARNING: "warning";
    readonly DANGER: "danger";
};
export type AuditAlertLevel = typeof AUDIT_ALERT_LEVELS[keyof typeof AUDIT_ALERT_LEVELS];
export declare const AUDIT_ALERT_STATUS: {
    readonly UNRESOLVED: "unresolved";
    readonly IN_PROGRESS: "in_progress";
    readonly RESOLVED: "resolved";
    readonly IGNORED: "ignored";
};
export type AuditAlertStatus = typeof AUDIT_ALERT_STATUS[keyof typeof AUDIT_ALERT_STATUS];
//# sourceMappingURL=audit-alerts.d.ts.map