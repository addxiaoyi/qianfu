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
import axios from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';
import * as cron from 'cron-parser';
// ============================================
// 配置
// ============================================
export const CONFIG = {
    alertmanager: {
        url: process.env.ALERTMANAGER_URL || 'http://localhost:9093',
        user: process.env.ALERTMANAGER_USER || '',
        password: process.env.ALERTMANAGER_PASSWORD || '',
    },
    checkInterval: 30000, // 30秒
    escalationTimelines: [
        { minutes: 5, level: 1, action: 'notify_oncall' },
        { minutes: 15, level: 2, action: 'notify_lead' },
        { minutes: 30, level: 3, action: 'notify_manager' },
        { minutes: 60, level: 4, action: 'notify_duty_head' },
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
export class AlertStateStore {
    alerts = new Map();
    escalationHistory = new Map();
    silencedAlerts = new Set();
    lastCheck = new Date();
    getAlert(alertId) {
        return this.alerts.get(alertId);
    }
    setAlert(alertId, alert) {
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
    updateAlert(alertId, updates) {
        const existing = this.alerts.get(alertId);
        if (existing) {
            this.alerts.set(alertId, { ...existing, ...updates });
        }
    }
    removeAlert(alertId) {
        this.alerts.delete(alertId);
        this.escalationHistory.delete(alertId);
    }
    addEscalationRecord(alertId, level, action) {
        if (!this.escalationHistory.has(alertId)) {
            this.escalationHistory.set(alertId, []);
        }
        this.escalationHistory.get(alertId).push({
            level,
            action,
            timestamp: new Date().toISOString(),
        });
    }
    isSilenced(alertId) {
        return this.silencedAlerts.has(alertId);
    }
    silenceAlert(alertId) {
        this.silencedAlerts.add(alertId);
    }
    unsilenceAlert(alertId) {
        this.silencedAlerts.delete(alertId);
    }
    getAllAlertIds() {
        return Array.from(this.alerts.keys());
    }
    getEscalationHistory(alertId) {
        return this.escalationHistory.get(alertId) || [];
    }
}
// ============================================
// Alertmanager API 客户端
// ============================================
export class AlertManagerApiClient {
    client;
    constructor(config) {
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
    async getAlerts(active = true) {
        try {
            const response = await this.client.get('/api/v2/alerts', {
                params: { active },
            });
            return response.data;
        }
        catch (error) {
            console.error('[AlertManager] Failed to get alerts:', error.message);
            return [];
        }
    }
    async getAlertGroups() {
        try {
            const response = await this.client.get('/api/v2/alertgroups');
            return response.data;
        }
        catch (error) {
            console.error('[AlertManager] Failed to get alert groups:', error.message);
            return [];
        }
    }
    async setSilence(matchers, durationMinutes) {
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
        }
        catch (error) {
            console.error('[AlertManager] Failed to set silence:', error.message);
            return null;
        }
    }
    async deleteSilence(silenceId) {
        try {
            await this.client.delete(`/api/v2/silence/${silenceId}`);
            return true;
        }
        catch (error) {
            console.error('[AlertManager] Failed to delete silence:', error.message);
            return false;
        }
    }
    async sendAlert(alert, level, action, receivers) {
        try {
            const levelReceivers = this.getReceiversForLevel(level, receivers);
            for (const receiver of levelReceivers) {
                await this.sendNotification(receiver, alert, level, action);
            }
            return true;
        }
        catch (error) {
            console.error('[AlertManager] Failed to send alert:', error.message);
            return false;
        }
    }
    getReceiversForLevel(level, receivers) {
        const result = [];
        if (level >= 1 && receivers.onCall)
            result.push({ type: 'oncall', webhook: receivers.onCall });
        if (level >= 2 && receivers.lead)
            result.push({ type: 'lead', webhook: receivers.lead });
        if (level >= 3 && receivers.manager)
            result.push({ type: 'manager', webhook: receivers.manager });
        if (level >= 4 && receivers.dutyHead)
            result.push({ type: 'dutyHead', webhook: receivers.dutyHead });
        if (level >= 5 && receivers.emergency)
            result.push({ type: 'emergency', webhook: receivers.emergency });
        return result;
    }
    async sendNotification(receiver, alert, level, action) {
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
    formatAlertMessage(alert, levelName, action) {
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
    config;
    pendingAlerts = new Map();
    flushTimer = null;
    constructor(config) {
        this.config = config;
    }
    addAlert(alert) {
        if (!this.config.enabled) {
            return alert;
        }
        const fingerprint = this.getFingerprint(alert);
        if (this.pendingAlerts.has(fingerprint)) {
            const existing = this.pendingAlerts.get(fingerprint);
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
    getFingerprint(alert) {
        const parts = [
            alert.labels?.alertname,
            alert.labels?.severity,
            alert.labels?.category,
            alert.labels?.team,
        ].filter(Boolean);
        return crypto.createHash('md5').update(parts.join(':')).digest('hex');
    }
    flush() {
        const alerts = Array.from(this.pendingAlerts.values());
        this.pendingAlerts.clear();
        this.flushTimer = null;
        return alerts;
    }
    destroy() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }
    }
}
// ============================================
// 静默窗口管理器
// ============================================
export class SilenceWindowManager {
    config;
    checkTimer = null;
    constructor(config) {
        this.config = config;
    }
    initialize() {
        this.checkMaintenanceWindow();
        this.checkBusinessHours();
        this.checkTimer = setInterval(() => {
            this.checkMaintenanceWindow();
            this.checkBusinessHours();
        }, 60000);
    }
    isInMaintenanceWindow() {
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
        }
        catch {
            return false;
        }
    }
    isInBusinessHours() {
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
    shouldSilence(alert) {
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
    matchesAny(alert, matchers) {
        return matchers.some(matcher => {
            const labelValue = alert.labels?.[matcher.name];
            if (!labelValue)
                return false;
            if (matcher.regex) {
                return new RegExp(matcher.value).test(labelValue);
            }
            return labelValue === matcher.value;
        });
    }
    checkMaintenanceWindow() {
        const isInWindow = this.isInMaintenanceWindow();
        console.log(`[Silence] Maintenance window: ${isInWindow ? 'ACTIVE' : 'inactive'}`);
    }
    checkBusinessHours() {
        const isInHours = this.isInBusinessHours();
        console.log(`[Silence] Business hours: ${isInHours ? 'ACTIVE' : 'inactive'}`);
    }
    destroy() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }
    }
}
// ============================================
// 告警升级引擎
// ============================================
export class EscalationEngine {
    state;
    alertManager;
    aggregator;
    silenceManager;
    config;
    checkTimer = null;
    running = false;
    constructor(config = CONFIG) {
        this.config = config;
        this.state = new AlertStateStore();
        this.alertManager = new AlertManagerApiClient(config.alertmanager);
        this.aggregator = new AlertAggregator(config.aggregation);
        this.silenceManager = new SilenceWindowManager(config.silenceWindows);
    }
    async start() {
        if (this.running) {
            console.log('[Escalation] Already running');
            return;
        }
        console.log('[Escalation] Starting escalation service...');
        this.silenceManager.initialize();
        this.running = true;
        this.checkTimer = setInterval(() => this.checkAndEscalate(), this.config.checkInterval);
        await this.checkAndEscalate();
        console.log('[Escalation] Escalation service started');
    }
    stop() {
        if (!this.running)
            return;
        console.log('[Escalation] Stopping escalation service...');
        this.running = false;
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        this.silenceManager.destroy();
        this.aggregator.destroy();
        console.log('[Escalation] Escalation service stopped');
    }
    async checkAndEscalate() {
        try {
            const alerts = await this.alertManager.getAlerts(true);
            await this.updateAlertState(alerts);
            await this.processEscalations();
            await this.processSilences(alerts);
            await this.cleanupResolvedAlerts(alerts);
            this.state.lastCheck = new Date();
        }
        catch (error) {
            console.error('[Escalation] Check failed:', error.message);
        }
    }
    async updateAlertState(alerts) {
        const currentAlertIds = new Set();
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
            }
            else {
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
    async processEscalations() {
        const now = Date.now();
        for (const alertId of this.state.getAllAlertIds()) {
            const alertState = this.state.getAlert(alertId);
            if (!alertState)
                continue;
            if (alertState.status === 'resolved' || alertState.status === 'suppressed') {
                continue;
            }
            const severity = 'warning'; // TODO: 从 alertState 获取
            const severityConfig = this.config.severityEscalation[severity];
            if (!severityConfig?.enabled)
                continue;
            const firstSeen = new Date(alertState.firstSeen).getTime();
            const elapsedMinutes = (now - firstSeen) / 1000 / 60;
            for (const timeline of this.config.escalationTimelines) {
                if (timeline.level < severityConfig.startLevel)
                    continue;
                if (timeline.level > severityConfig.maxLevel)
                    continue;
                const shouldEscalate = elapsedMinutes >= timeline.minutes &&
                    !alertState.notifiedLevels?.includes(timeline.level);
                if (shouldEscalate) {
                    console.log(`[Escalation] Escalating alert ${alertId} to level ${timeline.level}`);
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
    async getAlertById(alertId) {
        const alerts = await this.alertManager.getAlerts(true);
        return alerts.find(a => this.getAlertId(a) === alertId) || null;
    }
    async processSilences(alerts) {
        for (const alert of alerts) {
            const alertId = this.getAlertId(alert);
            if (this.silenceManager.shouldSilence(alert)) {
                if (!this.state.isSilenced(alertId)) {
                    console.log(`[Silence] Silencing alert ${alertId}`);
                    this.state.silenceAlert(alertId);
                    await this.alertManager.setSilence([
                        { name: 'alertname', value: alert.labels?.alertname || '', regex: false },
                        { name: 'instance', value: alert.labels?.instance || '', regex: false },
                    ], 60);
                }
            }
            else {
                if (this.state.isSilenced(alertId)) {
                    console.log(`[Silence] Unsilencing alert ${alertId}`);
                    this.state.unsilenceAlert(alertId);
                }
            }
        }
    }
    async cleanupResolvedAlerts(alerts) {
        const activeAlertIds = new Set(alerts.map(a => this.getAlertId(a)));
        for (const alertId of this.state.getAllAlertIds()) {
            if (!activeAlertIds.has(alertId)) {
                this.state.removeAlert(alertId);
            }
        }
    }
    async sendInitialNotification(alert) {
        const severity = alert.labels?.severity || 'warning';
        const severityConfig = this.config.severityEscalation[severity];
        const startLevel = severityConfig?.startLevel || 1;
        await this.alertManager.sendAlert(alert, startLevel, 'initial_notification', this.config.receivers);
    }
    getAlertId(alert) {
        const parts = [
            alert.fingerprint,
            alert.labels?.alertname,
            alert.labels?.instance,
        ].filter(Boolean);
        return crypto.createHash('md5').update(parts.join(':')).digest('hex');
    }
    async escalateManually(alertId, targetLevel) {
        const alert = await this.getAlertById(alertId);
        if (!alert) {
            console.error(`[Escalation] Alert ${alertId} not found`);
            return false;
        }
        await this.alertManager.sendAlert(alert, targetLevel, 'manual_escalation', this.config.receivers);
        return true;
    }
    getStatus() {
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
//# sourceMappingURL=escalationService.js.map