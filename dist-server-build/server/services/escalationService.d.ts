/**
 * 告警升级服务 - TypeScript 版本
 *
 * 功能：
 * 1. 自动升级未响应的告警到更高层级
 * 2. 按时间梯度升级（5分钟 → 15分钟 → 30分钟 → 1小时）
 * 3. 支持多级接收者（值班 → 组长 → 经理 → 值班主管）
 * 4. 支持告警聚合减少通知噪音
 * 5. 支持静默窗口配置
 */
export interface Alert {
    fingerprint: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    status: 'active' | 'resolved' | 'suppressed' | 'pending';
    startsAt: string;
    endsAt?: string;
    updatedAt: string;
    receiver: string;
}
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
export declare const CONFIG: EscalationConfig;
export interface AlertState {
    firstSeen: string;
    lastSeen: string;
    lastNotified: string;
    currentLevel: number;
    notifiedLevels: number[];
    status: string;
    count?: number;
}
export declare class AlertStateStore {
    private alerts;
    private escalationHistory;
    private silencedAlerts;
    lastCheck: Date;
    getAlert(alertId: string): AlertState | undefined;
    setAlert(alertId: string, alert: Partial<AlertState>): void;
    updateAlert(alertId: string, updates: Partial<AlertState>): void;
    removeAlert(alertId: string): void;
    addEscalationRecord(alertId: string, level: number, action: string): void;
    isSilenced(alertId: string): boolean;
    silenceAlert(alertId: string): void;
    unsilenceAlert(alertId: string): void;
    getAllAlertIds(): string[];
    getEscalationHistory(alertId: string): Array<{
        level: number;
        action: string;
        timestamp: string;
    }>;
}
export declare class AlertManagerApiClient {
    private client;
    constructor(config: EscalationConfig['alertmanager']);
    getAlerts(active?: boolean): Promise<Alert[]>;
    getAlertGroups(): Promise<unknown[]>;
    setSilence(matchers: SilenceMatcher[], durationMinutes: number): Promise<string | null>;
    deleteSilence(silenceId: string): Promise<boolean>;
    sendAlert(alert: Alert, level: number, action: string, receivers: EscalationConfig['receivers']): Promise<boolean>;
    private getReceiversForLevel;
    private sendNotification;
    private formatAlertMessage;
}
export declare class AlertAggregator {
    private config;
    private pendingAlerts;
    private flushTimer;
    constructor(config: EscalationConfig['aggregation']);
    addAlert(alert: Alert): Alert | null;
    private getFingerprint;
    flush(): Array<Alert & {
        count: number;
        firstSeen: string;
        lastSeen: string;
    }>;
    destroy(): void;
}
export declare class SilenceWindowManager {
    private config;
    private checkTimer;
    constructor(config: EscalationConfig['silenceWindows']);
    initialize(): void;
    isInMaintenanceWindow(): boolean;
    isInBusinessHours(): boolean;
    shouldSilence(alert: Alert): boolean;
    private matchesAny;
    private checkMaintenanceWindow;
    private checkBusinessHours;
    destroy(): void;
}
export declare class EscalationEngine {
    private state;
    private alertManager;
    private aggregator;
    private silenceManager;
    private config;
    private checkTimer;
    private running;
    constructor(config?: EscalationConfig);
    start(): Promise<void>;
    stop(): void;
    checkAndEscalate(): Promise<void>;
    private updateAlertState;
    private processEscalations;
    private getAlertById;
    private processSilences;
    private cleanupResolvedAlerts;
    private sendInitialNotification;
    private getAlertId;
    escalateManually(alertId: string, targetLevel: number): Promise<boolean>;
    getStatus(): {
        running: boolean;
        totalAlerts: number;
        silencedAlerts: number;
        lastCheck: Date;
        escalationTimelines: EscalationTimeline[];
        severityEscalation: Record<string, SeverityEscalationConfig>;
    };
}
export default EscalationEngine;
//# sourceMappingURL=escalationService.d.ts.map