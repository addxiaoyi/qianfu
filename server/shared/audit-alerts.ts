export const AUDIT_ALERT_LEVELS = {
  WARNING: 'warning',
  DANGER: 'danger',
} as const;

export type AuditAlertLevel = typeof AUDIT_ALERT_LEVELS[keyof typeof AUDIT_ALERT_LEVELS];

export const AUDIT_ALERT_STATUS = {
  UNRESOLVED: 'unresolved',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
} as const;

export type AuditAlertStatus = typeof AUDIT_ALERT_STATUS[keyof typeof AUDIT_ALERT_STATUS];
