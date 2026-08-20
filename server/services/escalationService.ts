import { logger } from '../utils/logger';
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

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';
import * as cron from 'cron-parser';

// ============================================
// 类型定义
// ============================================

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

// ============================================
// 配置
// ============================================

export const CONFIG: EscalationConfig = {
  alertmanager: {
    url: process.env.ALERTMANAGER_URL || 'http://localhost:9093',
    user: process.env.ALERTMANAGER_USER || '',
    password: process.env.ALERTMANAGER_PASSWORD || '',
  },

  checkInterval: 30000, // 30秒

  escalationTimelines: [
    { minutes: 5,   level: 1, action: 'notify_oncall' },
    { minutes: 15,  level: 2, action: 'notify_lead' },
    { minutes: 30,  level: 3, action: 'notify_manager' },
    { minutes: 60,  level: 4, action: 'notify_duty_head' },
    { minutes: 120, level: 5, action: 'notify_emergency' },
  ],

  severityEscalation: {
    critical: {
      enabled: true,
      startLevel: 1,
      maxLevel: 5,
      autoResolve: true,
      repeatInterval: 15,
    },
    warning: {
      enabled: true,
      startLevel: 2,
      maxLevel: 3,
      autoResolve: false,
      repeatInterval: 60,
    },
    info: {
      enabled: false,
      startLevel: 3,
      maxLevel: 2,
      autoResolve: false,
      repeatInterval: 240,
    },
  },

  aggregation: {
    enabled: true,
    windowSeconds: 300,
    maxAlertsPerGroup: 10,
  },

  silenceWindows: {
    maintenance: {
      enabled: process.env.ENABLE_MAINTENANCE_WINDOW === 'true',
      cron: '0 2 * * 0',
      duration: 120,
      matchers: [
        { name: 'category', value: 'availability', regex: false },
        { name: 'category', value: 'resource', regex: false },
      ],
    },
    businessHours: {
      enabled: process.env.ENABLE_BUSINESS_HOURS === 'true',
      startHour: 9,
      endHour: 18,
      workDays: [1, 2, 3, 4, 5],
      severityFilter: ['info'],
    },
  },

  receivers: {
    onCall: process.env.ONCALL_WEBHOOK || '',
    lead: process.env.LEAD_WEBHOOK || '',
    manager: process.env.MANAGER_WEBHOOK || '',
    dutyHead: process.env.DUTY_HEAD_WEBHOOK || '',
    emergency: process.env.EMERGENCY_WEBHOOK || '',
    email: process.env.ESCALATION_EMAIL || '',
  },

  channels: {
    webhook: true,
    email: true,
    sms: process.env.SMS_ENABLED === 'true',
    phone: process.env.PHONE_ENABLED === 'true',
  },
};

// ============================================
// 告警状态管理
// ============================================

export interface AlertState {
  firstSeen: string;
  lastSeen: string;
  lastNotified: string;
  currentLevel: number;
  notifiedLevels: number[];
  status: string;
  count?: number;
}

export class AlertStateStore {
  private alerts: Map<string, AlertState> = new Map();
  private escalationHistory: Map<string, Array<{ level: number; action: string; timestamp: string }>> = new Map();
  private silencedAlerts: Set<string> = new Set();
  lastCheck: Date = new Date();

  getAlert(alertId: string): AlertState | undefined {
    return this.alerts.get(alertId);
  }

  setAlert(alertId: string, alert: Partial<AlertState>): void {
    const existing = this.alerts.get(alertId);
    this.alerts.set(alertId, {
      firstSeen: existing?.firstSeen || new Date().toISOString(),
      lastSeen: existing?.lastSeen || new Date().toISOString(),
      lastNotified: existing?.lastNotified || new Date().toISOString(),
      currentLevel: existing?.currentLevel || 1,
      notifiedLevels: existing?.notifiedLevels || [],
      status: alert.status || 'active',
      count: alert.count || 1,
      ...existing,
    });
  }

  updateAlert(alertId: string, updates: Partial<AlertState>): void {
    const existing = this.alerts.get(alertId);
    if (existing) {
      this.alerts.set(alertId, { ...existing, ...updates });
    }
  }

  removeAlert(alertId: string): void {
    this.alerts.delete(alertId);
    this.escalationHistory.delete(alertId);
  }

  addEscalationRecord(alertId: string, level: number, action: string): void {
    if (!this.escalationHistory.has(alertId)) {
      this.escalationHistory.set(alertId, []);
    }
    this.escalationHistory.get(alertId)!.push({
      level,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  isSilenced(alertId: string): boolean {
    return this.silencedAlerts.has(alertId);
  }

  silenceAlert(alertId: string): void {
    this.silencedAlerts.add(alertId);
  }

  unsilenceAlert(alertId: string): void {
    this.silencedAlerts.delete(alertId);
  }

  getAllAlertIds(): string[] {
    return Array.from(this.alerts.keys());
  }

  getEscalationHistory(alertId: string): Array<{ level: number; action: string; timestamp: string }> {
    return this.escalationHistory.get(alertId) || [];
  }
}

// ============================================
// Alertmanager API 客户端
// ============================================

export class AlertManagerApiClient {
  private client: AxiosInstance;

  constructor(config: EscalationConfig['alertmanager']) {
    this.client = axios.create({
      baseURL: config.url,
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      auth: config.user ? {
        username: config.user,
        password: config.password,
      } : undefined,
    });
  }

  async getAlerts(active = true): Promise<Alert[]> {
    try {
      const response = await this.client.get('/api/v2/alerts', {
        params: { active },
      });
      return response.data;
    } catch (error) {
      logger.error('[AlertManager] Failed to get alerts:', (error as Error).message);
      return [];
    }
  }

  async getAlertGroups(): Promise<unknown[]> {
    try {
      const response = await this.client.get('/api/v2/alertgroups');
      return response.data;
    } catch (error) {
      logger.error('[AlertManager] Failed to get alert groups:', (error as Error).message);
      return [];
    }
  }

  async setSilence(matchers: SilenceMatcher[], durationMinutes: number): Promise<string | null> {
    try {
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const response = await this.client.post('/api/v2/silences', {
        matchers: matchers.map(m => ({
          name: m.name,
          value: m.value,
          isRegex: m.regex,
        })),
        startsAt: new Date().toISOString(),
        endsAt,
        createdBy: 'escalation-service',
        comment: `Auto-silenced by escalation service for ${durationMinutes} minutes`,
      });
      return response.data.silenceId;
    } catch (error) {
      logger.error('[AlertManager] Failed to set silence:', (error as Error).message);
      return null;
    }
  }

  async deleteSilence(silenceId: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/v2/silence/${silenceId}`);
      return true;
    } catch (error) {
      logger.error('[AlertManager] Failed to delete silence:', (error as Error).message);
      return false;
    }
  }

  async sendAlert(alert: Alert, level: number, action: string, receivers: EscalationConfig['receivers']): Promise<boolean> {
    try {
      const levelReceivers = this.getReceiversForLevel(level, receivers);

      for (const receiver of levelReceivers) {
        await this.sendNotification(receiver, alert, level, action);
      }

      return true;
    } catch (error) {
      logger.error('[AlertManager] Failed to send alert:', (error as Error).message);
      return false;
    }
  }

  private getReceiversForLevel(level: number, receivers: EscalationConfig['receivers']): Array<{ type: string; webhook: string }> {
    const result: Array<{ type: string; webhook: string }> = [];

    if (level >= 1 && receivers.onCall) result.push({ type: 'oncall', webhook: receivers.onCall });
    if (level >= 2 && receivers.lead) result.push({ type: 'lead', webhook: receivers.lead });
    if (level >= 3 && receivers.manager) result.push({ type: 'manager', webhook: receivers.manager });
    if (level >= 4 && receivers.dutyHead) result.push({ type: 'dutyHead', webhook: receivers.dutyHead });
    if (level >= 5 && receivers.emergency) result.push({ type: 'emergency', webhook: receivers.emergency });

    return result;
  }

  private async sendNotification(
    receiver: { type: string; webhook: string },
    alert: Alert,
    level: number,
    action: string
  ): Promise<void> {
    const levelNames = ['', '值班工程师', '技术组长', '部门经理', '值班主管', '紧急响应'];
    const levelName = levelNames[level] || `L${level}`;

    const message = {
      msgtype: 'text',
      text: {
        content: this.formatAlertMessage(alert, levelName, action),
      },
    };

    if (receiver.webhook) {
      await this.client.post(receiver.webhook, message);
    }
  }

  private formatAlertMessage(alert: Alert, levelName: string, action: string): string {
    const emoji = alert.status === 'resolved' ? '✅' : '🚨';
    return `${emoji} 【告警升级 - ${levelName}】

告警名称: ${alert.labels?.alertname || 'Unknown'}
实例: ${alert.labels?.instance || 'N/A'}
严重程度: ${alert.labels?.severity || 'unknown'}
类别: ${alert.labels?.category || 'N/A'}
团队: ${alert.labels?.team || 'N/A'}

描述: ${alert.annotations?.description || alert.annotations?.summary || 'N/A'}

操作: ${action}
时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

请及时处理！`;
  }
}

// ============================================
// 告警聚合器
// ============================================

export class AlertAggregator {
  private config: EscalationConfig['aggregation'];
  private pendingAlerts: Map<string, Alert & { count: number; firstSeen: string; lastSeen: string }> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: EscalationConfig['aggregation']) {
    this.config = config;
  }

  addAlert(alert: Alert): Alert | null {
    if (!this.config.enabled) {
      return alert;
    }

    const fingerprint = this.getFingerprint(alert);

    if (this.pendingAlerts.has(fingerprint)) {
      const existing = this.pendingAlerts.get(fingerprint)!;
      existing.count++;
      existing.lastSeen = new Date().toISOString();
      return null;
    }

    this.pendingAlerts.set(fingerprint, {
      ...alert,
      count: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.config.windowSeconds * 1000);
    }

    return null;
  }

  private getFingerprint(alert: Alert): string {
    const parts = [
      alert.labels?.alertname,
      alert.labels?.severity,
      alert.labels?.category,
      alert.labels?.team,
    ].filter(Boolean);

    return crypto.createHash('md5').update(parts.join(':')).digest('hex');
  }

  flush(): Array<Alert & { count: number; firstSeen: string; lastSeen: string }> {
    const alerts = Array.from(this.pendingAlerts.values());
    this.pendingAlerts.clear();
    this.flushTimer = null;
    return alerts;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
  }
}

// ============================================
// 静默窗口管理器
// ============================================

export class SilenceWindowManager {
  private config: EscalationConfig['silenceWindows'];
  private checkTimer: NodeJS.Timeout | null = null;

  constructor(config: EscalationConfig['silenceWindows']) {
    this.config = config;
  }

  initialize(): void {
    this.checkMaintenanceWindow();
    this.checkBusinessHours();

    this.checkTimer = setInterval(() => {
      this.checkMaintenanceWindow();
      this.checkBusinessHours();
    }, 60000);
  }

  isInMaintenanceWindow(): boolean {
    if (!this.config.maintenance?.enabled || !this.config.maintenance.cron) {
      return false;
    }

    try {
      const interval = cron.CronExpressionParser.parse(this.config.maintenance.cron);
      const next = interval.next().toDate();
      const now = new Date();
      const duration = (this.config.maintenance.duration || 120) * 60 * 1000;

      // 检查当前时间是否在维护窗口内
      const windowStart = new Date(next.getTime() - duration);
      const windowEnd = next;

      return now >= windowStart && now <= windowEnd;
    } catch {
      return false;
    }
  }

  isInBusinessHours(): boolean {
    if (!this.config.businessHours?.enabled) {
      return false;
    }

    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    const workDays = this.config.businessHours.workDays || [1, 2, 3, 4, 5];
    if (!workDays.includes(day)) {
      return false;
    }

    const startHour = this.config.businessHours.startHour ?? 9;
    const endHour = this.config.businessHours.endHour ?? 18;

    return hour >= startHour && hour < endHour;
  }

  shouldSilence(alert: Alert): boolean {
    if (this.isInMaintenanceWindow()) {
      const matchers = this.config.maintenance.matchers || [];
      return this.matchesAny(alert, matchers);
    }

    if (this.isInBusinessHours()) {
      const severityFilter = this.config.businessHours.severityFilter || [];
      if (severityFilter.includes(alert.labels?.severity || '')) {
        return true;
      }
    }

    return false;
  }

  private matchesAny(alert: Alert, matchers: SilenceMatcher[]): boolean {
    return matchers.some(matcher => {
      const labelValue = alert.labels?.[matcher.name];
      if (!labelValue) return false;

      if (matcher.regex) {
        return new RegExp(matcher.value).test(labelValue);
      }
      return labelValue === matcher.value;
    });
  }

  private checkMaintenanceWindow(): void {
    const isInWindow = this.isInMaintenanceWindow();
    logger.info(`[Silence] Maintenance window: ${isInWindow ? 'ACTIVE' : 'inactive'}`);
  }

  private checkBusinessHours(): void {
    const isInHours = this.isInBusinessHours();
    logger.info(`[Silence] Business hours: ${isInHours ? 'ACTIVE' : 'inactive'}`);
  }

  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
  }
}

// ============================================
// 告警升级引擎
// ============================================

export class EscalationEngine {
  private state: AlertStateStore;
  private alertManager: AlertManagerApiClient;
  private aggregator: AlertAggregator;
  private silenceManager: SilenceWindowManager;
  private config: EscalationConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(config: EscalationConfig = CONFIG) {
    this.config = config;
    this.state = new AlertStateStore();
    this.alertManager = new AlertManagerApiClient(config.alertmanager);
    this.aggregator = new AlertAggregator(config.aggregation);
    this.silenceManager = new SilenceWindowManager(config.silenceWindows);
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.info('[Escalation] Already running');
      return;
    }

    logger.info('[Escalation] Starting escalation service...');

    this.silenceManager.initialize();

    this.running = true;
    this.checkTimer = setInterval(() => this.checkAndEscalate(), this.config.checkInterval);

    await this.checkAndEscalate();

    logger.info('[Escalation] Escalation service started');
  }

  stop(): void {
    if (!this.running) return;

    logger.info('[Escalation] Stopping escalation service...');

    this.running = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    this.silenceManager.destroy();
    this.aggregator.destroy();

    logger.info('[Escalation] Escalation service stopped');
  }

  async checkAndEscalate(): Promise<void> {
    try {
      const alerts = await this.alertManager.getAlerts(true);

      await this.updateAlertState(alerts);
      await this.processEscalations();
      await this.processSilences(alerts);
      await this.cleanupResolvedAlerts(alerts);

      this.state.lastCheck = new Date();
    } catch (error) {
      logger.error('[Escalation] Check failed:', (error as Error).message);
    }
  }

  private async updateAlertState(alerts: Alert[]): Promise<void> {
    const currentAlertIds = new Set<string>();

    for (const alert of alerts) {
      const alertId = this.getAlertId(alert);
      currentAlertIds.add(alertId);

      const existing = this.state.getAlert(alertId);

      if (!existing) {
        this.state.setAlert(alertId, {
          status: alert.status,
          count: 1,
        });

        await this.sendInitialNotification(alert);
      } else {
        this.state.updateAlert(alertId, {
          lastSeen: new Date().toISOString(),
          status: alert.status,
        });
      }
    }

    for (const alertId of this.state.getAllAlertIds()) {
      if (!currentAlertIds.has(alertId)) {
        this.state.removeAlert(alertId);
      }
    }
  }

  private async processEscalations(): Promise<void> {
    const now = Date.now();

    for (const alertId of this.state.getAllAlertIds()) {
      const alertState = this.state.getAlert(alertId);
      if (!alertState) continue;

      if (alertState.status === 'resolved' || alertState.status === 'suppressed') {
        continue;
      }

      const severity = 'warning'; // TODO: 从 alertState 获取
      const severityConfig = this.config.severityEscalation[severity];

      if (!severityConfig?.enabled) continue;

      const firstSeen = new Date(alertState.firstSeen).getTime();
      const elapsedMinutes = (now - firstSeen) / 1000 / 60;

      for (const timeline of this.config.escalationTimelines) {
        if (timeline.level < severityConfig.startLevel) continue;
        if (timeline.level > severityConfig.maxLevel) continue;

        const shouldEscalate = elapsedMinutes >= timeline.minutes &&
          !alertState.notifiedLevels?.includes(timeline.level);

        if (shouldEscalate) {
          logger.info(`[Escalation] Escalating alert ${alertId} to level ${timeline.level}`);

          const alert = await this.getAlertById(alertId);
          if (alert) {
            await this.alertManager.sendAlert(alert, timeline.level, timeline.action, this.config.receivers);
          }

          this.state.updateAlert(alertId, {
            notifiedLevels: [...(alertState.notifiedLevels || []), timeline.level],
            currentLevel: timeline.level,
            lastNotified: new Date().toISOString(),
          });

          this.state.addEscalationRecord(alertId, timeline.level, timeline.action);
        }
      }
    }
  }

  private async getAlertById(alertId: string): Promise<Alert | null> {
    const alerts = await this.alertManager.getAlerts(true);
    return alerts.find(a => this.getAlertId(a) === alertId) || null;
  }

  private async processSilences(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      const alertId = this.getAlertId(alert);

      if (this.silenceManager.shouldSilence(alert)) {
        if (!this.state.isSilenced(alertId)) {
          logger.info(`[Silence] Silencing alert ${alertId}`);
          this.state.silenceAlert(alertId);

          await this.alertManager.setSilence(
            [
              { name: 'alertname', value: alert.labels?.alertname || '', regex: false },
              { name: 'instance', value: alert.labels?.instance || '', regex: false },
            ],
            60
          );
        }
      } else {
        if (this.state.isSilenced(alertId)) {
          logger.info(`[Silence] Unsilencing alert ${alertId}`);
          this.state.unsilenceAlert(alertId);
        }
      }
    }
  }

  private async cleanupResolvedAlerts(alerts: Alert[]): Promise<void> {
    const activeAlertIds = new Set(alerts.map(a => this.getAlertId(a)));

    for (const alertId of this.state.getAllAlertIds()) {
      if (!activeAlertIds.has(alertId)) {
        this.state.removeAlert(alertId);
      }
    }
  }

  private async sendInitialNotification(alert: Alert): Promise<void> {
    const severity = alert.labels?.severity || 'warning';
    const severityConfig = this.config.severityEscalation[severity];
    const startLevel = severityConfig?.startLevel || 1;

    await this.alertManager.sendAlert(alert, startLevel, 'initial_notification', this.config.receivers);
  }

  private getAlertId(alert: Alert): string {
    const parts = [
      alert.fingerprint,
      alert.labels?.alertname,
      alert.labels?.instance,
    ].filter(Boolean);

    return crypto.createHash('md5').update(parts.join(':')).digest('hex');
  }

  async escalateManually(alertId: string, targetLevel: number): Promise<boolean> {
    const alert = await this.getAlertById(alertId);
    if (!alert) {
      logger.error(`[Escalation] Alert ${alertId} not found`);
      return false;
    }

    await this.alertManager.sendAlert(alert, targetLevel, 'manual_escalation', this.config.receivers);
    return true;
  }

  getStatus(): {
    running: boolean;
    totalAlerts: number;
    silencedAlerts: number;
    lastCheck: Date;
    escalationTimelines: EscalationTimeline[];
    severityEscalation: Record<string, SeverityEscalationConfig>;
  } {
    return {
      running: this.running,
      totalAlerts: this.state.getAllAlertIds().length,
      silencedAlerts: 0, // TODO
      lastCheck: this.state.lastCheck,
      escalationTimelines: this.config.escalationTimelines,
      severityEscalation: this.config.severityEscalation,
    };
  }
}

// ============================================
// 默认导出
// ============================================

export default EscalationEngine;
