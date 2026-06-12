import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { escapeHtmlChars } from '../utils/xssProtection';
import { getEffectiveMailRuntime, type EffectiveMailRuntime } from './mailConfigService.js';

const FEISHU_RATE_WINDOW_MS = 100 * 1000;
const FEISHU_RATE_MAX_PER_WINDOW = 160;
const FEISHU_DAILY_MAX = 80;
const sentTimestamps: number[] = [];
let dailyCount = 0;
let dailyDate = '';

function checkFeishuRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  if (dailyDate !== today) {
    dailyCount = 0;
    dailyDate = today;
    sentTimestamps.length = 0;
  }

  if (dailyCount >= FEISHU_DAILY_MAX) {
    return { allowed: false, reason: '日发送限额已耗尽' };
  }

  const windowStart = now - FEISHU_RATE_WINDOW_MS;
  while (sentTimestamps.length > 0 && sentTimestamps[0] < windowStart) {
    sentTimestamps.shift();
  }

  if (sentTimestamps.length >= FEISHU_RATE_MAX_PER_WINDOW) {
    const waitMs = sentTimestamps[0] + FEISHU_RATE_WINDOW_MS - now;
    return { allowed: false, reason: `窗口内发送限额不足，请等待 ${Math.ceil(waitMs / 1000)}s` };
  }

  return { allowed: true };
}

function recordSend(): void {
  sentTimestamps.push(Date.now());
  dailyCount += 1;
}

function getRuntimeSourceLabel(runtime: EffectiveMailRuntime): string {
  return runtime.transport.source;
}

function isFeishuRuntime(runtime: EffectiveMailRuntime): boolean {
  return runtime.transport.kind === 'smtp' && runtime.transport.source === 'env-feishu-smtp';
}

async function sendViaBrevoApi(
  runtime: EffectiveMailRuntime,
  payload: { to: string | string[]; subject: string; html: string; bcc?: string[] },
) {
  if (runtime.transport.kind !== 'brevo-api') {
    throw new Error('invalid brevo runtime');
  }

  await axios.post(
    `${runtime.transport.apiBaseUrl}/smtp/email`,
    {
      sender: {
        name: process.env.BRAND_NAME || 'QianFu',
        email: runtime.transport.from,
      },
      to: (Array.isArray(payload.to) ? payload.to : [payload.to]).map((email) => ({ email })),
      bcc: payload.bcc?.map((email) => ({ email })),
      subject: payload.subject,
      htmlContent: payload.html,
    },
    {
      headers: {
        'api-key': runtime.transport.apiKey,
        'content-type': 'application/json',
      },
      timeout: 12000,
    },
  );
}

function createTransporter(runtime: EffectiveMailRuntime): nodemailer.Transporter {
  if (runtime.transport.kind === 'smtp') {
    return nodemailer.createTransport({
      host: runtime.transport.host,
      port: runtime.transport.port,
      secure: runtime.transport.secure,
      auth: runtime.transport.user
        ? {
            user: runtime.transport.user,
            pass: runtime.transport.pass,
          }
        : undefined,
      tls:
        runtime.transport.tlsRejectUnauthorized === false
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  if (runtime.transport.kind === 'service') {
    return nodemailer.createTransport({
      service: runtime.transport.service,
      auth: {
        user: runtime.transport.user,
        pass: runtime.transport.pass,
      },
    });
  }

  throw new Error('mail runtime does not support transporter creation');
}

const buildEmailTemplate = (options: {
  title: string;
  brandName: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaLink?: string;
}) => {
  const { title, brandName, logoUrl, contactEmail, contactPhone, bodyHtml, ctaLabel, ctaLink } = options;
  const buttonHtml =
    ctaLabel && ctaLink
      ? `<p style="margin:14px 0;"><a class="btn" href="${ctaLink}">${ctaLabel}</a></p>`
      : '';

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f7f7f9;margin:0;padding:24px;color:#1f2937}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.12)}.header{display:flex;align-items:center;gap:12px;padding:16px 20px;background:#0b1220;color:#fff}.header img{height:32px}.content{padding:24px 20px;line-height:1.7}.btn{display:inline-block;padding:12px 22px;background:#2563EB;color:#fff!important;text-decoration:none;font-weight:600;border-radius:10px}.link{word-break:break-all;color:#2563EB}.muted{color:#475569}.footer{padding:16px 20px;font-size:12px;color:#64748b;background:#f8fafc;border-top:1px solid #e2e8f0}</style></head><body><div class="container"><div class="header"><img src="${logoUrl}" alt="${brandName} Logo"/><strong>${brandName}</strong></div><div class="content"><h2 style="margin:0 0 8px;">${title}</h2>${bodyHtml}${buttonHtml}</div><div class="footer"><div><strong>${brandName}</strong></div><p>联系：${contactEmail} | ${contactPhone}</p></div></div></body></html>`;
};

async function getMailMeta() {
  const runtime = await getEffectiveMailRuntime();
  const port = process.env.PORT || 3000;
  return {
    runtime,
    brandName: process.env.BRAND_NAME || '千服 QianFu',
    logoUrl: process.env.BRAND_LOGO_URL || 'https://qianfu.example.com/assets/logo-mail.png',
    contactEmail: runtime.meta.contactEmail || 'support@qianfu.example.com',
    contactPhone: runtime.meta.contactPhone || '+86 400-100-8888',
    emailBaseUrl: runtime.meta.emailBaseUrl || process.env.EMAIL_BASE_URL || `http://localhost:${port}`,
  };
}

async function sendMailSmart(
  payload: { to: string | string[]; subject: string; html: string; bcc?: string[] },
  runtimeOverride?: EffectiveMailRuntime,
) {
  const runtime = runtimeOverride || await getEffectiveMailRuntime();

  if (!runtime.enabled || !runtime.configured || runtime.transport.kind === 'none') {
    logger.warn('[EmailService] Mail runtime unavailable, skipping send', {
      source: getRuntimeSourceLabel(runtime),
    });
    return;
  }

  if (isFeishuRuntime(runtime)) {
    const rl = checkFeishuRateLimit();
    if (!rl.allowed) {
      logger.warn(`[EmailService] Feishu rate limit: ${rl.reason}`);
      throw new Error(`邮件发送受限：${rl.reason}`);
    }
  }

  if (runtime.transport.kind === 'brevo-api') {
    await sendViaBrevoApi(runtime, payload);
    return;
  }

  const transporter = createTransporter(runtime);
  const from = runtime.transport.from;

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    bcc: payload.bcc,
  });

  if (runtime.transport.kind === 'smtp' && isFeishuRuntime(runtime)) {
    recordSend();
  }
}

export async function sendDiagnosticEmail(to: string, subject: string, message: string) {
  const meta = await getMailMeta();
  if (!meta.runtime.enabled || !meta.runtime.configured || meta.runtime.transport.kind === 'none') {
    throw new Error('邮件运行时尚未配置');
  }

  await sendMailSmart(
    {
      to,
      subject,
      html: buildEmailTemplate({
        title: subject,
        brandName: meta.brandName,
        logoUrl: meta.logoUrl,
        contactEmail: meta.contactEmail,
        contactPhone: meta.contactPhone,
        bodyHtml: `<p style="margin:4px 0;">这是一封来自超管配置中心的测试邮件。</p><p style="margin:10px 0;">${escapeHtmlChars(message)}</p><p class="muted" style="margin:10px 0;">当前发信源：${escapeHtmlChars(getRuntimeSourceLabel(meta.runtime))}</p>`,
      }),
    },
    meta.runtime,
  );
}

function textToEmailHtml(text: string): string {
  return escapeHtmlChars(text).replace(/\r?\n/g, '<br />');
}

export async function sendAdminBroadcastEmail(options: {
  recipients: string[];
  subject: string;
  message: string;
  mode?: 'product' | 'maintenance' | 'custom';
  ctaLabel?: string;
  ctaLink?: string;
}) {
  const meta = await getMailMeta();
  if (!meta.runtime.enabled || !meta.runtime.configured || meta.runtime.transport.kind === 'none') {
    throw new Error('邮件运行时尚未配置');
  }

  const mode = options.mode || 'custom';
  const supportEmail = meta.runtime.transport.from || meta.contactEmail;
  const normalizedRecipients = Array.from(new Set(options.recipients.map((item) => item.trim().toLowerCase()).filter(Boolean)));
  if (!normalizedRecipients.length) {
    throw new Error('收件人列表为空');
  }

  const maxRecipientsPerBatch = 50;
  const safeTitle =
    mode === 'product'
      ? `产品推广通知 | ${meta.brandName}`
      : mode === 'maintenance'
        ? `系统维护通知 | ${meta.brandName}`
        : options.subject;

  const bodyPrefix =
    mode === 'product'
      ? '<p style="margin:4px 0;">您好，以下是最新产品/服务推广通知：</p>'
      : mode === 'maintenance'
        ? '<p style="margin:4px 0;">您好，以下是系统维护通知，请及时关注：</p>'
        : '<p style="margin:4px 0;">您好，以下是来自系统管理员的通知：</p>';

  const html = buildEmailTemplate({
    title: safeTitle,
    brandName: meta.brandName,
    logoUrl: meta.logoUrl,
    contactEmail: meta.contactEmail,
    contactPhone: meta.contactPhone,
    bodyHtml: `${bodyPrefix}<p style="margin:10px 0;">${textToEmailHtml(options.message)}</p>`,
    ctaLabel: options.ctaLabel,
    ctaLink: options.ctaLink,
  });

  for (let index = 0; index < normalizedRecipients.length; index += maxRecipientsPerBatch) {
    const chunk = normalizedRecipients.slice(index, index + maxRecipientsPerBatch);
    await sendMailSmart(
      {
        to: supportEmail,
        bcc: chunk,
        subject: safeTitle,
        html,
      },
      meta.runtime,
    );
  }

  return {
    total: normalizedRecipients.length,
    batches: Math.ceil(normalizedRecipients.length / maxRecipientsPerBatch),
    subject: safeTitle,
    source: getRuntimeSourceLabel(meta.runtime),
  };
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const meta = await getMailMeta();
  const verificationLink = `${meta.emailBaseUrl}/api/verify-email?token=${token}`;
  const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
  const masked = escapeHtmlChars(maskedRaw);
  const title = `验证邮箱 | ${meta.brandName}`;

  if (!meta.runtime.enabled || !meta.runtime.configured || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    await sendMailSmart({
      to: email,
      subject: title,
      html: buildEmailTemplate({
        title,
        brandName: meta.brandName,
        logoUrl: meta.logoUrl,
        contactEmail: meta.contactEmail,
        contactPhone: meta.contactPhone,
        bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">欢迎来到千服。请点击下方按钮完成邮箱验证：</p><p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${verificationLink}</p><p class="muted" style="margin:10px 0;">该链接 24 小时内有效。</p>`,
        ctaLabel: '立即验证邮箱',
        ctaLink: verificationLink,
      }),
    }, meta.runtime);
  } catch (error: any) {
    logger.error(`[EmailService] Failed to send verification email to ${email}: ${error.message}`);
  }
};

export const sendEmailLoginCode = async (email: string, code: string) => {
  const meta = await getMailMeta();
  const title = `登录验证码 | ${meta.brandName}`;
  const safeCode = escapeHtmlChars(code);
  const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
  const masked = escapeHtmlChars(maskedRaw);

  if (!meta.runtime.enabled || !meta.runtime.configured || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    await sendMailSmart({
      to: email,
      subject: title,
      html: buildEmailTemplate({
        title,
        brandName: meta.brandName,
        logoUrl: meta.logoUrl,
        contactEmail: meta.contactEmail,
        contactPhone: meta.contactPhone,
        bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">您的一次性登录验证码如下：</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:10px 0;">${safeCode}</p><p class="muted" style="margin:10px 0;">验证码有效期 10 分钟，请勿泄露给他人。</p>`,
      }),
    }, meta.runtime);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[EmailService] Failed to send login code email to ${email}: ${msg}`);
  }
};

export function toHashSpaPasswordResetLink(superTokensLink: string): string {
  try {
    const u = new URL(superTokensLink);
    const token = u.searchParams.get('token');
    if (!token) return superTokensLink;
    const tenantId = u.searchParams.get('tenantId');
    const base = (process.env.FRONTEND_URL || `${u.protocol}//${u.host}`).replace(/\/$/, '');
    const qs = new URLSearchParams();
    qs.set('token', token);
    if (tenantId) qs.set('tenantId', tenantId);
    return `${base}/reset-password?${qs.toString()}`;
  } catch {
    return superTokensLink;
  }
}

export const sendSuperTokensPasswordResetEmail = async (email: string, passwordResetLink: string) => {
  const meta = await getMailMeta();
  const linkForEmail = toHashSpaPasswordResetLink(passwordResetLink);
  const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
  const masked = escapeHtmlChars(maskedRaw);
  const title = `重置密码 | ${meta.brandName}`;

  if (!meta.runtime.enabled || !meta.runtime.configured || process.env.NODE_ENV === 'test') {
    logger.warn('[EmailService] SuperTokens 密码重置邮件已跳过（未配置邮件通道）');
    return;
  }

  try {
    await sendMailSmart({
      to: email,
      subject: title,
      html: buildEmailTemplate({
        title,
        brandName: meta.brandName,
        logoUrl: meta.logoUrl,
        contactEmail: meta.contactEmail,
        contactPhone: meta.contactPhone,
        bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">我们收到了重置密码请求。如非本人操作，请忽略本邮件并及时检查账号安全。</p><p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${escapeHtmlChars(linkForEmail)}</p><p class="muted" style="margin:10px 0;">链接有效期以系统安全策略为准，请尽快操作。</p>`,
        ctaLabel: '立即重置密码',
        ctaLink: escapeHtmlChars(linkForEmail),
      }),
    }, meta.runtime);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[EmailService] SuperTokens 密码重置邮件发送失败 ${email}: ${msg}`);
  }
};

export const sendPasswordResetEmail = async (email: string, token: string, code?: string) => {
  const meta = await getMailMeta();
  const resetLink = `${meta.emailBaseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const maskedRaw = email.replace(/(.{2}).*(@.*)/, '$1***$2');
  const masked = escapeHtmlChars(maskedRaw);
  const title = `重置密码 | ${meta.brandName}`;
  const codeHtml = code
    ? `<p style="margin:10px 0;">也可以在页面中输入验证码：</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:10px 0;">${escapeHtmlChars(code)}</p>`
    : '';

  if (!meta.runtime.enabled || !meta.runtime.configured || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    await sendMailSmart({
      to: email,
      subject: title,
      html: buildEmailTemplate({
        title,
        brandName: meta.brandName,
        logoUrl: meta.logoUrl,
        contactEmail: meta.contactEmail,
        contactPhone: meta.contactPhone,
        bodyHtml: `<p style="margin:4px 0;">您好（${masked}），</p><p style="margin:4px 0;">我们收到了重置密码请求。如非本人操作，请忽略本邮件。</p>${codeHtml}<p style="margin:6px 0;">如果按钮无法点击，可复制以下链接到浏览器：</p><p class="link">${resetLink}</p><p class="muted" style="margin:10px 0;">该链接 1 小时内有效，验证码 10 分钟内有效。</p>`,
        ctaLabel: '重置密码',
        ctaLink: resetLink,
      }),
    }, meta.runtime);
  } catch (error: any) {
    logger.error(`[EmailService] Failed to send password reset email to ${email}: ${error.message}`);
  }
};

export const sendTicketNotification = async (ticket: any, user: any, adminEmails: string[]) => {
  const meta = await getMailMeta();
  const ticketLink = `${meta.emailBaseUrl || 'http://localhost:3000'}/admin/tickets/${ticket.id}`;

  if (!meta.runtime.enabled || !meta.runtime.configured || process.env.NODE_ENV === 'test') {
    return;
  }

  const safeTitle = escapeHtmlChars(ticket.title || '');
  const safeDescription = escapeHtmlChars(ticket.description || '');
  const safeUsername = escapeHtmlChars(user.username || '');
  const safeEmail = escapeHtmlChars(user.email || '');
  const safePriority = escapeHtmlChars(ticket.priority || 'MEDIUM');
  const supportEmail =
    meta.runtime.transport.kind === 'none'
      ? meta.contactEmail
      : meta.runtime.transport.from || meta.contactEmail;

  try {
    const maxRecipients = 50;
    for (let index = 0; index < adminEmails.length; index += maxRecipients) {
      const chunk = adminEmails.slice(index, index + maxRecipients);
      await sendMailSmart({
        to: supportEmail,
        bcc: chunk,
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
              <div class="header"><strong>${meta.brandName} Support</strong></div>
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
        `,
      }, meta.runtime);
    }
  } catch (error: any) {
    logger.error(`[EmailService] Failed to send ticket notification for #${ticket.id}: ${error.message}`);
  }
};
