import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getEffectiveMailRuntime } from './mailConfigService.js';
import { sanitizeMailHtml } from './mailContentService.js';
import { getPopMessage, listPopInbox } from './pop3InboxService.js';
const INBOX_PAGE_SIZE = 50;
function addressList(value) {
    if (!value || typeof value === 'string')
        return [];
    const entries = Array.isArray(value) ? value : value.value;
    return entries.map((item) => ({ name: item.name || '', address: item.address || '' }));
}
function toMessage(info, parsed, unread) {
    const text = parsed.text || '';
    const html = typeof parsed.html === 'string' ? sanitizeMailHtml(parsed.html) : sanitizeMailHtml(text.replace(/\r?\n/g, '<br>'));
    const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
    return {
        id: String(info.uid),
        uid: Number(info.uid),
        subject: parsed.subject || '(无主题)',
        from: addressList(parsed.from),
        to: addressList(parsed.to),
        date: (parsed.date || new Date()).toISOString(),
        unread,
        hasAttachments: parsed.attachments.length > 0,
        preview: text.replace(/\s+/g, ' ').trim().slice(0, 240),
        text,
        html,
        messageId: parsed.messageId,
        references,
        attachments: parsed.attachments.map((item) => ({ filename: item.filename || 'attachment', contentType: item.contentType, size: item.size, cid: item.cid })),
    };
}
async function withClient(run) {
    const runtime = await getEffectiveMailRuntime();
    const config = resolveImapConfig(runtime);
    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: config.rejectUnauthorized },
        logger: false,
    });
    await client.connect();
    try {
        return await run(client);
    }
    finally {
        await client.logout().catch(() => undefined);
    }
}
export function resolveImapConfig(runtime) {
    const user = runtime.adminConfig.imapUser || runtime.adminConfig.smtpUser;
    const pass = runtime.adminConfig.imapPass || runtime.adminConfig.smtpPass;
    const host = runtime.adminConfig.imapHost || runtime.adminConfig.smtpHost;
    if (!host || !user || !pass)
        throw new Error('IMAP 收件箱配置不完整');
    return {
        host,
        port: runtime.adminConfig.imapPort || 993,
        secure: runtime.adminConfig.imapSecure,
        user,
        pass,
        rejectUnauthorized: !runtime.adminConfig.imapAllowInvalidCert,
    };
}
export function normalizeReplySubject(subject) {
    return /^(re|回复)\s*:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}
export function buildReplyHeaders(message) {
    const references = [...message.references];
    if (message.messageId && !references.includes(message.messageId))
        references.push(message.messageId);
    return { inReplyTo: message.messageId, references };
}
export function buildInboxRange(total, page, pageSize) {
    if (total < 1)
        return null;
    const end = total - (page - 1) * pageSize;
    if (end < 1)
        return null;
    return { start: Math.max(1, end - pageSize + 1), end };
}
export async function listInbox(page = 1) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const runtime = await getEffectiveMailRuntime();
    if (runtime.adminConfig.inboxProtocol === 'POP3')
        return listPopInbox(safePage);
    return withClient(async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
            const status = await client.status('INBOX', { messages: true });
            const total = status.messages || 0;
            const range = buildInboxRange(total, safePage, INBOX_PAGE_SIZE);
            const messages = [];
            if (range) {
                for await (const item of client.fetch(`${range.start}:${range.end}`, { uid: true, envelope: true, flags: true, source: true }, { uid: false })) {
                    if (!item.source)
                        continue;
                    const parsed = await simpleParser(item.source);
                    messages.push(toMessage(item, parsed, !item.flags?.has('\\Seen')));
                }
            }
            messages.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
            return { page: safePage, pageSize: INBOX_PAGE_SIZE, total, messages };
        }
        finally {
            lock.release();
        }
    });
}
export async function getInboxMessage(uid) {
    if (!Number.isInteger(uid) || uid < 1)
        throw new Error('邮件编号无效');
    const runtime = await getEffectiveMailRuntime();
    if (runtime.adminConfig.inboxProtocol === 'POP3')
        return getPopMessage(uid);
    return withClient(async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
            const item = await client.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true });
            if (!item || !item.source)
                throw new Error('邮件不存在');
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            const parsed = await simpleParser(item.source);
            return toMessage(item, parsed, false);
        }
        finally {
            lock.release();
        }
    });
}
//# sourceMappingURL=mailInboxService.js.map