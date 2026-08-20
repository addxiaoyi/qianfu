/**
 * Alert Escalation Service Type Definitions
 */

export interface Alert {
  fingerprint: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  status: AlertStatus;
  startsAt: string;
  endsAt?: string;
  updatedAt: string;
  receiver: string;
}

export type AlertStatus = 'active' | 'resolved' | 'suppressed' | 'pending';

export interface EscalationTimeline {
  minutes: number;
  level: number;
  action: string;
}

export interface SeverityEscalationConfig {
  enabled: boolean;
  startLevel: number;
  maxLevel: number;
  autoResolve: boolean;
  repeatInterval: number;
}

export interface SilenceMatcher {
  name: string;
  value: string;
  regex: boolean;
}

export interface SilenceConfig {
  enabled: boolean;
  cron?: string;
  duration?: number;
  matchers?: SilenceMatcher[];
  startHour?: number;
  endHour?: number;
  workDays?: number[];
  severityFilter?: string[];
}

export interface EscalationConfig {
  alertmanager: {
    url: string;
    user: string;
    password: string;
  };
  checkInterval: number;
  escalationTimelines: EscalationTimeline[];
  severityEscalation: Record<string, SeverityEscalationConfig>;
  aggregation: {
    enabled: boolean;
    windowSeconds: number;
    maxAlertsPerGroup: number;
  };
  silenceWindows: {
    maintenance: SilenceConfig;
    businessHours: SilenceConfig;
  };
  receivers: {
    onCall: string;
    lead: string;
    manager: string;
    dutyHead: string;
    emergency: string;
    email: string;
  };
  channels: {
    webhook: boolean;
    email: boolean;
    sms: boolean;
    phone: boolean;
  };
}

export interface AlertState {
  firstSeen: string;
  lastSeen: string;
  lastNotified: string;
  currentLevel: number;
  notifiedLevels: number[];
  status: string;
  count?: number;
}

export interface EscalationRecord {
  level: number;
  action: string;
  timestamp: string;
}

export interface ServiceStatus {
  running: boolean;
  totalAlerts: number;
  silencedAlerts: number;
  lastCheck: Date;
  escalationTimelines: EscalationTimeline[];
  severityEscalation: Record<string, SeverityEscalationConfig>;
}

export interface NotificationPayload {
  alertId: string;
  alertName: string;
  instance: string;
  severity: string;
  category: string;
  team: string;
  description: string;
  level: number;
  levelName: string;
  action: string;
  timestamp: string;
}
