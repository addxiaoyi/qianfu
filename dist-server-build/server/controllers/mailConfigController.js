import { z } from 'zod';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { getRouteParam } from '../utils/requestParams';
import { getMailConfigForAdmin, saveMailConfig } from '../services/mailConfigService';
import { sendAdminBroadcastEmail, sendAdminComposedEmail, sendDiagnosticEmail } from '../services/emailService';
import { getInboxMessage, listInbox, buildReplyHeaders, normalizeReplySubject } from '../services/mailInboxService';
import { deleteMailRecipientGroup, deleteMailSchedule, deleteMailTemplate, importMailLibrary, listMailLibrary, recordMailHistory, upsertMailRecipientGroup, upsertMailSchedule, upsertMailTemplate, } from '../services/mailLibraryService';
const mailConfigSchema = z.object({
    enabled: z.boolean(),
    smtpHost: z.string().trim().max(255).optional().default(''),
    smtpPort: z.number().int().min(1).max(65535),
    smtpSecure: z.boolean(),
    smtpAllowInvalidCert: z.boolean().optional().default(false),
    smtpUser: z.string().trim().max(255).optional().default(''),
    smtpPass: z.string().max(512).optional().default(''),
    clearSmtpPass: z.boolean().optional().default(false),
    emailFrom: z.string().trim().max(255).optional().default(''),
    fromName: z.string().trim().max(120).optional().default(''),
    replyTo: z.string().trim().email('回复地址格式无效').or(z.literal('')).optional().default(''),
    imapHost: z.string().trim().max(255).optional().default(''),
    imapPort: z.number().int().min(1).max(65535).optional().default(993),
    imapSecure: z.boolean().optional().default(true),
    imapAllowInvalidCert: z.boolean().optional().default(false),
    imapUser: z.string().trim().max(255).optional().default(''),
    imapPass: z.string().max(512).optional().default(''),
    clearImapPass: z.boolean().optional().default(false),
    contactEmail: z.string().trim().max(255).optional().default(''),
    contactPhone: z.string().trim().max(64).optional().default(''),
    emailBaseUrl: z.string().trim().max(255).optional().default(''),
});
const mailTestSchema = z.object({
    to: z.string().trim().email('测试收件人邮箱格式无效'),
    subject: z.string().trim().min(1).max(120).optional().default('QianFu Mail Test'),
    message: z.string().trim().min(1).max(4000).optional().default('This is a test message from QianFu admin mail config.'),
});
const mailBroadcastSchema = z.object({
    mode: z.enum(['product', 'maintenance', 'custom']).default('custom'),
    recipients: z.array(z.string().trim().email('收件人邮箱格式无效')).min(1).max(200),
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(12000),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaLink: z.string().trim().max(500).optional(),
});
const mailComposeSchema = z.object({
    to: z.array(z.string().trim().email('收件人邮箱格式无效')).min(1).max(50),
    subject: z.string().trim().min(1).max(160),
    html: z.string().min(1).max(100000),
    fromName: z.string().trim().max(120).optional(),
    replyTo: z.string().trim().email('回复地址格式无效').optional(),
});
const mailTemplateSchema = z.object({
    key: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(80),
    mode: z.enum(['product', 'maintenance', 'custom']).default('custom'),
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(12000),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaLink: z.string().trim().max(500).optional(),
});
const mailRecipientGroupSchema = z.object({
    key: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).optional(),
    recipients: z.array(z.string().trim().email('收件人邮箱格式无效')).min(1).max(500),
});
const mailScheduleSchema = z.object({
    key: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    mode: z.enum(['product', 'maintenance', 'custom']).default('custom'),
    scheduleType: z.enum(['once', 'daily']),
    onceAt: z.string().trim().optional(),
    dailyTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().trim().max(80).optional(),
    recipients: z.array(z.string().trim().email('收件人邮箱格式无效')).max(500).default([]),
    recipientGroupKeys: z.array(z.string().trim().min(1).max(64)).max(100).optional().default([]),
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(12000),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaLink: z.string().trim().max(500).optional(),
    lastRunAt: z.string().trim().optional(),
});
const mailLibraryImportSchema = z.object({
    templates: z.array(mailTemplateSchema).optional().default([]),
    recipientGroups: z.array(mailRecipientGroupSchema).optional().default([]),
    schedules: z.array(mailScheduleSchema).optional().default([]),
});
export const getMailConfig = async (_req, res, next) => {
    try {
        const payload = await getMailConfigForAdmin();
        return sendSuccess(res, payload, 'Success', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const getMailLibrary = async (_req, res, next) => {
    try {
        const payload = await listMailLibrary();
        return sendSuccess(res, payload, 'Success', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const updateMailConfig = async (req, res, next) => {
    try {
        const parsed = mailConfigSchema.safeParse(req.body || {});
        if (!parsed.success) {
            throw new AppError('邮件配置格式不合法', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        if (parsed.data.enabled && !parsed.data.smtpHost) {
            throw new AppError('启用邮件发送时必须填写 SMTP Host', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (parsed.data.enabled && !parsed.data.emailFrom) {
            throw new AppError('启用邮件发送时必须填写发件人地址', 400, ErrorCode.VALIDATION_ERROR);
        }
        const nextConfig = { ...parsed.data };
        if (!nextConfig.smtpPass && !nextConfig.clearSmtpPass) {
            delete nextConfig.smtpPass;
        }
        if (!nextConfig.imapPass && !nextConfig.clearImapPass) {
            delete nextConfig.imapPass;
        }
        delete nextConfig.clearSmtpPass;
        delete nextConfig.clearImapPass;
        const config = await saveMailConfig(nextConfig);
        const responsePayload = await getMailConfigForAdmin();
        return sendSuccess(res, { ...responsePayload, config }, 'Mail config updated', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const sendMailConfigTest = async (req, res, next) => {
    try {
        const parsed = mailTestSchema.safeParse(req.body || {});
        if (!parsed.success) {
            throw new AppError('测试邮件参数无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        try {
            await sendDiagnosticEmail(parsed.data.to, parsed.data.subject, parsed.data.message);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new AppError(`邮件测试发送失败: ${reason}`, 503, ErrorCode.SERVICE_UNAVAILABLE, true);
        }
        await recordMailHistory({
            kind: 'test',
            subject: parsed.data.subject,
            messagePreview: parsed.data.message.slice(0, 240),
            recipients: [parsed.data.to],
            totalRecipients: 1,
            source: 'system',
            operator: req.user?.username || req.user?.email || 'admin',
        });
        return sendSuccess(res, {
            to: parsed.data.to,
            subject: parsed.data.subject,
        }, 'Test email sent', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const sendMailBroadcast = async (req, res, next) => {
    try {
        const parsed = mailBroadcastSchema.safeParse(req.body || {});
        if (!parsed.success) {
            throw new AppError('批量邮件参数无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        const result = await sendAdminBroadcastEmail(parsed.data);
        await recordMailHistory({
            kind: 'broadcast',
            mode: parsed.data.mode,
            subject: result.subject,
            messagePreview: parsed.data.message.slice(0, 240),
            recipients: parsed.data.recipients,
            totalRecipients: result.total,
            source: result.source,
            operator: req.user?.username || req.user?.email || 'admin',
        });
        return sendSuccess(res, result, 'Broadcast email sent', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const sendMailComposed = async (req, res, next) => {
    try {
        const parsed = mailComposeSchema.safeParse(req.body || {});
        if (!parsed.success)
            throw new AppError('写信参数无效', 400, ErrorCode.VALIDATION_ERROR, true, { issues: parsed.error.issues });
        const result = await sendAdminComposedEmail(parsed.data);
        return sendSuccess(res, result, 'Email sent', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const getMailInbox = async (req, res, next) => {
    try {
        const page = Number(req.query.page || 1);
        return sendSuccess(res, await listInbox(page), 'Success', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const getMailInboxMessage = async (req, res, next) => {
    try {
        const uid = Number(getRouteParam(req.params.uid));
        return sendSuccess(res, await getInboxMessage(uid), 'Success', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const replyMailInboxMessage = async (req, res, next) => {
    try {
        const parsed = z.object({ html: z.string().min(1).max(100000), fromName: z.string().trim().max(120).optional() }).safeParse(req.body || {});
        if (!parsed.success)
            throw new AppError('回复内容无效', 400, ErrorCode.VALIDATION_ERROR, true, { issues: parsed.error.issues });
        const source = await getInboxMessage(Number(getRouteParam(req.params.uid)));
        const recipient = source.from.find((item) => item.address)?.address;
        if (!recipient)
            throw new AppError('原邮件没有可回复的地址', 400, ErrorCode.VALIDATION_ERROR);
        const result = await sendAdminComposedEmail({
            to: [recipient],
            subject: normalizeReplySubject(source.subject),
            html: parsed.data.html,
            fromName: parsed.data.fromName,
            replyTo: source.from[0]?.address,
            inReplyTo: buildReplyHeaders(source).inReplyTo,
            references: buildReplyHeaders(source).references,
        });
        return sendSuccess(res, { ...result, headers: buildReplyHeaders(source) }, 'Reply sent', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const upsertMailTemplateEntry = async (req, res, next) => {
    try {
        const parsed = mailTemplateSchema.safeParse({
            ...req.body,
            key: getRouteParam(req.params.key) || req.body?.key,
        });
        if (!parsed.success) {
            throw new AppError('邮件模板参数无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        const template = await upsertMailTemplate(parsed.data);
        return sendSuccess(res, template, 'Mail template saved', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const deleteMailTemplateEntry = async (req, res, next) => {
    try {
        await deleteMailTemplate(getRouteParam(req.params.key));
        return sendSuccess(res, { key: getRouteParam(req.params.key) }, 'Mail template deleted', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const upsertMailRecipientGroupEntry = async (req, res, next) => {
    try {
        const parsed = mailRecipientGroupSchema.safeParse({
            ...req.body,
            key: getRouteParam(req.params.key) || req.body?.key,
        });
        if (!parsed.success) {
            throw new AppError('收件组参数无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        const group = await upsertMailRecipientGroup(parsed.data);
        return sendSuccess(res, group, 'Mail recipient group saved', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const deleteMailRecipientGroupEntry = async (req, res, next) => {
    try {
        await deleteMailRecipientGroup(getRouteParam(req.params.key));
        return sendSuccess(res, { key: getRouteParam(req.params.key) }, 'Mail recipient group deleted', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const upsertMailScheduleEntry = async (req, res, next) => {
    try {
        const parsed = mailScheduleSchema.safeParse({
            ...req.body,
            key: getRouteParam(req.params.key) || req.body?.key,
        });
        if (!parsed.success) {
            throw new AppError('定时任务参数无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        if (parsed.data.scheduleType === 'once' && !parsed.data.onceAt) {
            throw new AppError('一次性任务必须填写 onceAt', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (parsed.data.scheduleType === 'daily' && !parsed.data.dailyTime) {
            throw new AppError('每日任务必须填写 dailyTime', 400, ErrorCode.VALIDATION_ERROR);
        }
        const schedule = await upsertMailSchedule(parsed.data);
        return sendSuccess(res, schedule, 'Mail schedule saved', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const deleteMailScheduleEntry = async (req, res, next) => {
    try {
        await deleteMailSchedule(getRouteParam(req.params.key));
        return sendSuccess(res, { key: getRouteParam(req.params.key) }, 'Mail schedule deleted', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
export const importMailLibraryEntries = async (req, res, next) => {
    try {
        const parsed = mailLibraryImportSchema.safeParse(req.body || {});
        if (!parsed.success) {
            throw new AppError('导入内容格式无效', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: parsed.error.issues,
            });
        }
        const result = await importMailLibrary(parsed.data);
        return sendSuccess(res, result, 'Mail library imported', 200, undefined, { mask: false });
    }
    catch (error) {
        return next(error);
    }
};
//# sourceMappingURL=mailConfigController.js.map