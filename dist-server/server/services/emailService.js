import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { escapeHtmlChars } from '../utils/xssProtection';
// ── Feishu SMTP (primary) ──────────────────────────────────────────
const feishuSmtpHost = process.env.FEISHU_SMTP_HOST;
const feishuSmtpPort = process.env.FEISHU_SMTP_PORT
    ? Number(process.env.FEISHU_SMTP_PORT)
    : 587;
const feishuSmtpSecure = process.env.FEISHU_SMTP_SECURE === 'true';
const feishuSmtpUser = process.env.FEISHU_SMTP_LOGIN;
const feishuSmtpPass = process.env.FEISHU_SMTP_KEY;
const feishuSmtpFrom = process.env.FEISHU_SMTP_FROM || feishuSmtpUser;
const useFeishuSmtp = !!feishuSmtpHost;
// ── Brevo SMTP / API (fallback) ────────────────────────────────────
const brevoSmtpHost = process.env.BREVO_SMTP_HOST;
const brevoSmtpPort = process.env.BREVO_SMTP_PORT
    ? Number(process.env.BREVO_SMTP_PORT)
    : 587;
const brevoSmtpSecure = process.env.BREVO_SMTP_SECURE === 'true';
const brevoSmtpUser = process.env.BREVO_SMTP_LOGIN;
const brevoSmtpPass = process.env.BREVO_SMTP_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;
const brevoApiBaseUrl = process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3';
const useBrevoApi = !!brevoApiKey;
// ── Transport selection (Feishu > Brevo SMTP > fallback) ────────────
const usePrimarySmtp = useFeishuSmtp || !!brevoSmtpHost;
let transporter;
if (useFeishuSmtp) {
    transporter = nodemailer.createTransport({
        host: feishuSmtpHost,
        port: feishuSmtpPort,
        secure: feishuSmtpSecure,
        auth: {
            user: feishuSmtpUser,
            pass: feishuSmtpPass,
        },
        tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
    });
}
else if (brevoSmtpHost) {
    transporter = nodemailer.createTransport({
        host: brevoSmtpHost,
        port: brevoSmtpPort,
        secure: brevoSmtpSecure,
        auth: {
            user: brevoSmtpUser,
            pass: brevoSmtpPass,
        },
        tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
    });
}
else {
    transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}
// ── From address (priority: Feishu > Brevo > fallback) ─────────────
const getFromAddress = () => feishuSmtpFrom || process.env.BREVO_SMTP_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM || feishuSmtpUser || brevoSmtpUser || process.env.EMAIL_USER;
// ── Feishu SMTP rate limiter ────────────────────────────────────────
// 飞书企业邮箱限制：200 封/100 秒，100 封/天
// 采用滑动窗口 + 日限额双控
const FEISHU_RATE_WINDOW_MS = 100 * 1000; // 100s
const FEISHU_RATE_MAX_PER_WINDOW = 160; // 留 20% 余量 (200 * 0.8)
const FEISHU_DAILY_MAX = 80; // 留 20% 余量 (100 * 0.8)
const _sentTimestamps = []; // 滑动窗口记录
let _dailyCount = 0;
let _dailyDate = '';
function checkFeishuRateLimit() {
    if (!useFeishuSmtp)
        return { allowed: true };
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    // 重置日计数器
    if (_dailyDate !== today) {
        _dailyCount = 0;
        _dailyDate = today;
        _sentTimestamps.length = 0;
    }
    // 日限额检查
    if (_dailyCount >= FEISHU_DAILY_MAX) {
        return { allowed: false, reason: '日发送限额已耗尽' };
    }
    // 滑动窗口检查 (200/100s)
    const windowStart = now - FEISHU_RATE_WINDOW_MS;
    while (_sentTimestamps.length > 0 && _sentTimestamps[0] < windowStart) {
        _sentTimestamps.shift();
    }
    if (_sentTimestamps.length >= FEISHU_RATE_MAX_PER_WINDOW) {
        const waitMs = _sentTimestamps[0] + FEISHU_RATE_WINDOW_MS - now;
        return { allowed: false, reason: `窗口内发送限额不足，请等待 ${Math.ceil(waitMs / 1000)}s` };
    }
    return { allowed: true };
}
function recordSend() {
    _sentTimestamps.push(Date.now());
    _dailyCount++;
}
const sendViaBrevoApi = async (to, subject, htmlContent) => {
    if (!brevoApiKey) {
        logger.warn('[EmailService] BREVO_API_KEY not configured, skipping Brevo send');
        return;
    }
    const fromEmail = getFromAddress();
    if (!fromEmail) {
        logger.warn('[EmailService] No sender configured, skipping Brevo send');
        return;
    }
    await axios.post(`${brevoApiBaseUrl}/smtp/email`, {
        sender: {
            name: process.env.BRAND_NAME || 'QianFu',
            email: fromEmail,
        },
        to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
        subject,
        htmlContent,
    }, {
        headers: {
            'api-key': brevoApiKey,
            'content-type': 'application/json',
        },
        timeout: 12000,
    });
};
const sendMailSmart = async (payload) => {
    const from = getFromAddress();
    if (!from) {
        logger.warn('[EmailService] No sender configured, skipping email send');
        return;
    }
    // ── Feishu SMTP 限流检查 ───────────────────────────────────────
    if (useFeishuSmtp) {
        const rl = checkFeishuRateLimit();
        if (!rl.allowed) {
            logger.warn(`[EmailService] Feishu rate limit: ${rl.reason}`);
            throw new Error(`邮件发送受限：${rl.reason}`);
        }
    }
    if (useBrevoApi) {
        if (payload.bcc && payload.bcc.length > 0) {
            await axios.post(`${brevoApiBaseUrl}/smtp/email`, {
                sender: {
                    name: process.env.BRAND_NAME || 'QianFu',
                    email: from,
                },
                to: [{ email: Array.isArray(payload.to) ? payload.to[0] : payload.to }],
                bcc: payload.bcc.map((email) => ({ email })),
                subject: payload.subject,
                htmlContent: payload.html,
            }, {
                headers: {
                    'api-key': brevoApiKey,
                    'content-type': 'application/json',
                },
                timeout: 12000,
            });
            return;
        }
        await sendViaBrevoApi(payload.to, payload.subject, payload.html);
        return;
    }
    await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        bcc: payload.bcc,
    });
    // ── 记录发送（仅 SMTP 模式，API 模式由 Brevo 自带统计） ────────
    if (useFeishuSmtp || (brevoSmtpHost && !useFeishuSmtp)) {
        recordSend();
    }
};
const buildEmailTemplate = (options) => {
    const { title, brandName, logoUrl, contactEmail, contactPhone, bodyHtml, ctaLabel, ctaLink } = options;
    const buttonHtml = ctaLabel && ctaLink
        ? `<p style="margin:14px 0;"><a class="btn" href="${ctaLink}">${ctaLabel}</a></p>`
        : '';
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f7f7f9;margin:0;padding:24px;color:#1f2937}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.12)}.header{display:flex;align-items:center;gap:12px;padding:16px 20px;background:#0b1220;color:#fff}.header img{height:32px}.content{padding:24px 20px;line-height:1.7}.btn{display:inline-block;padding:12px 22px;background:#2563EB;color:#fff!important;text-decoration:none;font-weight:600;border-radius:10px}.link{word-break:break-all;color:#2563EB}.muted{color:#475569}.footer{padding:16px 20px;font-size:12px;color:#64748b;background:#f8fafc;border-top:1px solid #e2e8f0}</style></head><body><div class="container"><div class="header"><img src="${logoUrl}" alt="${brandName} Logo"/><strong>${brandName}</strong></div><div class="content"><h2 style="margin:0 0 8px;">${title}</h2>${bodyHtml}${buttonHtml}</div><div class="footer"><div><strong>${brandName}</strong></div><p>联系：${contactEmail} | ${contactPhone}</p></div></div></body></html>`;
};
export const sendVerificationEmail = async (email, token) => {
    const port = process.env.PORT || 3000;
    const baseUrl = process.env.EMAIL_BASE_URL || `http://localhost:${port}`;
    const verificationLink = `${baseUrl}/api/verify-email?token=${token}`;
    const brandName = process.env.BRAND_NAME || '千服 QianFu';
    const logoUrl = process.env.BRAND_LOGO_URL || 'https://qianfu.example.com/assets/logo-mail.png';
    const contactEmail = process.env.CONTACT_EMAIL || 'support@qianfu.example.com';
    const contactPhone = process.env.CONTACT_PHONE || '+86 400-100-8888';
    const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const masked = escapeHtmlChars(maskedRaw);
    const title = `验证邮箱 | ${brandName}`;
    if ((!process.env.SMTP_USER && !process.env.EMAIL_USER && !useBrevoApi) || process.env.NODE_ENV === 'test') {
        return;
    }
    try {
        await sendMailSmart({
            to: email,
            subject: title,
            html: buildEmailTemplate({
                title,
                brandName,
                logoUrl,
                contactEmail,
                contactPhone,
                bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">欢迎来到千服。请点击下方按钮完成邮箱验证：</p><p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${verificationLink}</p><p class="muted" style="margin:10px 0;">该链接 24 小时内有效。</p>`,
                ctaLabel: '立即验证邮箱',
                ctaLink: verificationLink,
            }),
        });
    }
    catch (error) {
        logger.error(`[EmailService] Failed to send verification email to ${email}: ${error.message}`);
        return;
    }
};
export const sendEmailLoginCode = async (email, code) => {
    const brandName = process.env.BRAND_NAME || '千服 QianFu';
    const logoUrl = process.env.BRAND_LOGO_URL || 'https://qianfu.example.com/assets/logo-mail.png';
    const contactEmail = process.env.CONTACT_EMAIL || 'support@qianfu.example.com';
    const contactPhone = process.env.CONTACT_PHONE || '+86 400-100-8888';
    const title = `登录验证码 | ${brandName}`;
    const safeCode = escapeHtmlChars(code);
    const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const masked = escapeHtmlChars(maskedRaw);
    if ((!feishuSmtpUser && !process.env.EMAIL_USER && !useBrevoApi) || process.env.NODE_ENV === 'test') {
        return;
    }
    try {
        await sendMailSmart({
            to: email,
            subject: title,
            html: buildEmailTemplate({
                title,
                brandName,
                logoUrl,
                contactEmail,
                contactPhone,
                bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">您的一次性登录验证码如下：</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:10px 0;">${safeCode}</p><p class="muted" style="margin:10px 0;">验证码有效期 10 分钟，请勿泄露给他人。</p>`,
            }),
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[EmailService] Failed to send login code email to ${email}: ${msg}`);
        return;
    }
};
/**
 * SuperTokens 默认链接多为 `/auth/reset-password?token=...`（会打到后端）。
 * 本站为 Hash 路由，改为 `/?token=...#/reset-password`，便于 SDK 从 location.search 读 token。
 */
export function toHashSpaPasswordResetLink(superTokensLink) {
    try {
        const u = new URL(superTokensLink);
        const token = u.searchParams.get('token');
        if (!token)
            return superTokensLink;
        const tenantId = u.searchParams.get('tenantId');
        const base = (process.env.FRONTEND_URL || `${u.protocol}//${u.host}`).replace(/\/$/, '');
        const qs = new URLSearchParams();
        qs.set('token', token);
        if (tenantId)
            qs.set('tenantId', tenantId);
        return `${base}/?${qs.toString()}#/reset-password`;
    }
    catch {
        return superTokensLink;
    }
}
/** SuperTokens 生成的完整重置链接（含 token），经项目 SMTP 发出 */
export const sendSuperTokensPasswordResetEmail = async (email, passwordResetLink) => {
    const linkForEmail = toHashSpaPasswordResetLink(passwordResetLink);
    const brandName = process.env.BRAND_NAME || 'QianFu';
    const logoUrl = process.env.BRAND_LOGO_URL || 'https://qianfu.example.com/assets/logo-mail.png';
    const contactEmail = process.env.CONTACT_EMAIL || 'support@qianfu.example.com';
    const contactPhone = process.env.CONTACT_PHONE || '+86 400-100-8888';
    const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const masked = escapeHtmlChars(maskedRaw);
    const title = `重置密码 | ${brandName}`;
    if ((!feishuSmtpUser && !process.env.EMAIL_USER && !useBrevoApi) || process.env.NODE_ENV === 'test') {
        logger.warn('[EmailService] SuperTokens 密码重置邮件已跳过（未配置 BREVO/SMTP/EMAIL 通道）');
        return;
    }
    try {
        await sendMailSmart({
            to: email,
            subject: title,
            html: buildEmailTemplate({
                title,
                brandName,
                logoUrl,
                contactEmail,
                contactPhone,
                bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">我们收到了重置密码请求。如非本人操作，请忽略本邮件并及时检查账号安全。</p><p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${escapeHtmlChars(linkForEmail)}</p><p class="muted" style="margin:10px 0;">链接有效期以系统安全策略为准，请尽快操作。</p>`,
                ctaLabel: '立即重置密码',
                ctaLink: escapeHtmlChars(linkForEmail),
            }),
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[EmailService] SuperTokens 密码重置邮件发送失败 ${email}: ${msg}`);
        return;
    }
};
export const sendPasswordResetEmail = async (email, token) => {
    const port = process.env.PORT || 3000;
    const baseUrl = process.env.EMAIL_BASE_URL || `http://localhost:${port}`;
    const resetLink = `${baseUrl}/#/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    const brandName = process.env.BRAND_NAME || '千服 QianFu';
    const logoUrl = process.env.BRAND_LOGO_URL || 'https://qianfu.example.com/assets/logo-mail.png';
    const contactEmail = process.env.CONTACT_EMAIL || 'support@qianfu.example.com';
    const contactPhone = process.env.CONTACT_PHONE || '+86 400-100-8888';
    const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const masked = escapeHtmlChars(maskedRaw);
    const title = `重置密码 | ${brandName}`;
    if ((!process.env.SMTP_USER && !process.env.EMAIL_USER && !useBrevoApi) || process.env.NODE_ENV === 'test') {
        return;
    }
    try {
        await sendMailSmart({
            to: email,
            subject: title,
            html: buildEmailTemplate({
                title,
                brandName,
                logoUrl,
                contactEmail,
                contactPhone,
                bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">我们收到了重置密码请求。如非本人操作，请忽略本邮件。</p><p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${resetLink}</p><p class="muted" style="margin:10px 0;">该链接 1 小时内有效。</p>`,
                ctaLabel: '重置密码',
                ctaLink: resetLink,
            }),
        });
    }
    catch (error) {
        logger.error(`[EmailService] Failed to send password reset email to ${email}: ${error.message}`);
        return;
    }
};
export const sendTicketNotification = async (ticket, user, adminEmails) => {
    const brandName = process.env.BRAND_NAME || '千服 QianFu';
    const ticketLink = `${process.env.EMAIL_BASE_URL || 'http://localhost:3000'}/#/admin/tickets/${ticket.id}`;
    if (process.env.NODE_ENV === 'test' || (!feishuSmtpUser && !process.env.EMAIL_USER && !useBrevoApi)) {
        return;
    }
    // Sanitize inputs
    const safeTitle = escapeHtmlChars(ticket.title || '');
    const safeDescription = escapeHtmlChars(ticket.description || '');
    const safeUsername = escapeHtmlChars(user.username || '');
    const safeEmail = escapeHtmlChars(user.email || '');
    const safePriority = escapeHtmlChars(ticket.priority || 'MEDIUM');
    const supportEmail = getFromAddress();
    try {
        // Use BCC to avoid leaking admin emails to each other
        // and limit to 50 recipients per mail to avoid SMTP provider limits
        const maxRecipients = 50;
        const recipientChunks = [];
        for (let i = 0; i < adminEmails.length; i += maxRecipients) {
            recipientChunks.push(adminEmails.slice(i, i + maxRecipients));
        }
        for (const chunk of recipientChunks) {
            await transporter.sendMail({
                from: getFromAddress(),
                to: supportEmail, // Send to self
                bcc: chunk, // Hide admin list
                subject: `[New Ticket] #${ticket.id} - ${safeTitle}`,
                html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8"/>
                <style>
                    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f7f7f9;margin:0;padding:24px;color:#222}
                    .container{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.08)}
                    .header{padding:16px 20px;background:#0a0a0a;color:#fff}
                    .content{padding:24px 20px;line-height:1.7}
                    .btn{display:inline-block;padding:12px 20px;background:#2563EB;color:#fff!important;text-decoration:none;font-weight:600;border-radius:8px}
                    .meta{background:#f4f4f5;padding:12px;border-radius:8px;margin:16px 0;font-size:14px}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><strong>${brandName} Support</strong></div>
                    <div class="content">
                        <h2>New Ticket Created</h2>
                        <div class="meta">
                            <p><strong>Ticket ID:</strong> #${ticket.id}</p>
                            <p><strong>User:</strong> ${safeUsername} (${safeEmail})</p>
                            <p><strong>Priority:</strong> ${safePriority}</p>
                            <p><strong>Title:</strong> ${safeTitle}</p>
                        </div>
                        <p><strong>Description:</strong></p>
                        <p>${safeDescription}</p>
                        <p style="margin-top:24px;">
                            <a class="btn" href="${ticketLink}">View Ticket</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `
            });
        }
    }
    catch (error) {
        logger.error(`[EmailService] Failed to send ticket notification for #${ticket.id}: ${error.message}`);
        return;
    }
};
//# sourceMappingURL=emailService.js.map