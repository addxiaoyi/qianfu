import POP3Client from 'poplib';
import { simpleParser } from 'mailparser';
import { getEffectiveMailRuntime } from './mailConfigService.js';
import { sanitizeMailHtml } from './mailContentService.js';
function resolvePopConfig(runtime) {
    const config = runtime.adminConfig;
    const user = config.imapUser || config.smtpUser;
    const pass = config.imapPass || config.smtpPass;
    const host = config.imapHost || config.smtpHost;
    if (!host || !user || !pass)
        throw new Error('POP3 收件箱配置不完整');
    return { host, port: config.imapPort || 995, secure: config.imapSecure, user, pass, rejectUnauthorized: !config.imapAllowInvalidCert };
}
function command(client, event, start, read) {
    return new Promise((resolve, reject) => {
        const onError = (error) => { cleanup(); reject(error); };
        const onEvent = (...args) => {
            cleanup();
            Promise.resolve(read(...args)).then(resolve, reject);
        };
        const cleanup = () => { client.removeListener?.('error', onError); client.removeListener?.(event, onEvent); };
        client.once('error', onError);
        client.once(event, onEvent);
        start(client);
    });
}
async function withPop(run) {
    const config = resolvePopConfig(await getEffectiveMailRuntime());
    const client = new POP3Client(config.port, config.host, { enabletls: config.secure, tlserrs: !config.rejectUnauthorized, debug: false });
    try {
        await command(client, 'connect', () => undefined, (ok, raw) => { if (!ok)
            throw new Error(`POP3 连接失败: ${raw}`); return true; });
        await command(client, 'login', (current) => current.login(config.user, config.pass), (ok, raw) => { if (!ok)
            throw new Error(`POP3 登录失败: ${raw}`); return true; });
        return await run(client);
    }
    finally {
        await command(client, 'quit', (current) => current.quit(), (ok) => ok).catch(() => undefined);
    }
}
function parsePopMessage(messageNumber, raw) {
    return simpleParser(raw).then((parsed) => {
        const text = parsed.text || '';
        const html = typeof parsed.html === 'string' ? sanitizeMailHtml(parsed.html) : sanitizeMailHtml(text.replace(/\r?\n/g, '<br>'));
        const addresses = (value) => !value || typeof value === 'string' ? [] : (Array.isArray(value) ? value : value.value).map((item) => ({ name: item.name || '', address: item.address || '' }));
        return { id: `pop:${messageNumber}`, uid: messageNumber, subject: parsed.subject || '(无主题)', from: addresses(parsed.from), to: addresses(parsed.to), date: (parsed.date || new Date()).toISOString(), unread: false, hasAttachments: parsed.attachments.length > 0, preview: text.replace(/\s+/g, ' ').trim().slice(0, 240), text, html, messageId: parsed.messageId, references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [], attachments: parsed.attachments.map((item) => ({ filename: item.filename || 'attachment', contentType: item.contentType, size: item.size, cid: item.cid })) };
    });
}
export async function listPopInbox(page = 1) {
    const pageSize = 50;
    return withPop(async (client) => {
        const stat = await command(client, 'stat', (current) => current.stat(), (_ok, data) => Number(data?.count || 0));
        const end = stat - (page - 1) * pageSize;
        const start = Math.max(1, end - pageSize + 1);
        const messages = [];
        for (let number = end; number >= start; number -= 1) {
            const raw = await command(client, 'retr', (current) => current.retr(number), (ok, _number, data, raw) => { if (!ok)
                throw new Error(`POP3 读取邮件失败: ${raw}`); return String(data || raw || ''); });
            messages.push(await parsePopMessage(number, raw));
        }
        return { page, pageSize, total: stat, messages };
    });
}
export async function getPopMessage(number) {
    return withPop(async (client) => {
        const raw = await command(client, 'retr', (current) => current.retr(number), (ok, _number, data, response) => { if (!ok)
            throw new Error(`POP3 读取邮件失败: ${response}`); return String(data || response || ''); });
        return parsePopMessage(number, raw);
    });
}
//# sourceMappingURL=pop3InboxService.js.map