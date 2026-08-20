import crypto from 'crypto';
import prisma from '../db';
const MAIL_TEMPLATE_PREFIX = 'mail_template:';
const MAIL_GROUP_PREFIX = 'mail_group:';
const MAIL_HISTORY_PREFIX = 'mail_history:';
const MAIL_SCHEDULE_PREFIX = 'mail_schedule:';
const MAIL_HISTORY_LIMIT = 100;
function normalizeKey(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
        throw new Error('invalid key');
    }
    return value;
}
function parseJson(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function uniqueEmails(items) {
    return Array.from(new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}
async function upsertJsonConfig(key, value, description) {
    await prisma.systemConfig.upsert({
        where: { key },
        update: {
            value: JSON.stringify(value),
            is_secret: false,
            description,
        },
        create: {
            key,
            value: JSON.stringify(value),
            is_secret: false,
            description,
        },
    });
}
export async function listMailLibrary() {
    const [templateRows, groupRows, historyRows, scheduleRows] = await Promise.all([
        prisma.systemConfig.findMany({
            where: { key: { startsWith: MAIL_TEMPLATE_PREFIX } },
            orderBy: { updated_at: 'desc' },
        }),
        prisma.systemConfig.findMany({
            where: { key: { startsWith: MAIL_GROUP_PREFIX } },
            orderBy: { updated_at: 'desc' },
        }),
        prisma.systemConfig.findMany({
            where: { key: { startsWith: MAIL_HISTORY_PREFIX } },
            orderBy: { updated_at: 'desc' },
            take: 20,
        }),
        prisma.systemConfig.findMany({
            where: { key: { startsWith: MAIL_SCHEDULE_PREFIX } },
            orderBy: { updated_at: 'desc' },
        }),
    ]);
    const templates = templateRows
        .map((row) => parseJson(row.value))
        .filter((row) => Boolean(row));
    const recipientGroups = groupRows
        .map((row) => parseJson(row.value))
        .filter((row) => Boolean(row));
    const history = historyRows
        .map((row) => parseJson(row.value))
        .filter((row) => Boolean(row));
    const schedules = scheduleRows
        .map((row) => parseJson(row.value))
        .filter((row) => Boolean(row));
    return { templates, recipientGroups, history, schedules };
}
export async function upsertMailTemplate(input) {
    const key = normalizeKey(input.key);
    const record = {
        ...input,
        key,
        updatedAt: new Date().toISOString(),
    };
    await upsertJsonConfig(`${MAIL_TEMPLATE_PREFIX}${key}`, record, `Mail template ${key}`);
    return record;
}
export async function deleteMailTemplate(keyRaw) {
    const key = normalizeKey(keyRaw);
    await prisma.systemConfig.deleteMany({
        where: { key: `${MAIL_TEMPLATE_PREFIX}${key}` },
    });
}
export async function upsertMailRecipientGroup(input) {
    const key = normalizeKey(input.key);
    const record = {
        ...input,
        key,
        recipients: uniqueEmails(input.recipients),
        updatedAt: new Date().toISOString(),
    };
    await upsertJsonConfig(`${MAIL_GROUP_PREFIX}${key}`, record, `Mail recipient group ${key}`);
    return record;
}
export async function deleteMailRecipientGroup(keyRaw) {
    const key = normalizeKey(keyRaw);
    await prisma.systemConfig.deleteMany({
        where: { key: `${MAIL_GROUP_PREFIX}${key}` },
    });
}
export async function upsertMailSchedule(input) {
    const key = normalizeKey(input.key);
    const record = {
        ...input,
        key,
        recipients: uniqueEmails(input.recipients),
        recipientGroupKeys: Array.from(new Set((input.recipientGroupKeys || []).map((item) => normalizeKey(item)))),
        timezone: input.timezone || 'Asia/Shanghai',
        updatedAt: new Date().toISOString(),
    };
    await upsertJsonConfig(`${MAIL_SCHEDULE_PREFIX}${key}`, record, `Mail schedule ${key}`);
    return record;
}
export async function deleteMailSchedule(keyRaw) {
    const key = normalizeKey(keyRaw);
    await prisma.systemConfig.deleteMany({
        where: { key: `${MAIL_SCHEDULE_PREFIX}${key}` },
    });
}
export async function recordMailHistory(input) {
    const id = crypto.randomUUID();
    const record = {
        ...input,
        id,
        createdAt: new Date().toISOString(),
    };
    await upsertJsonConfig(`${MAIL_HISTORY_PREFIX}${record.createdAt}:${id}`, record, `Mail history ${record.kind}`);
    const historyRows = await prisma.systemConfig.findMany({
        where: { key: { startsWith: MAIL_HISTORY_PREFIX } },
        orderBy: { updated_at: 'desc' },
        skip: MAIL_HISTORY_LIMIT,
    });
    if (historyRows.length) {
        await prisma.systemConfig.deleteMany({
            where: {
                key: {
                    in: historyRows.map((item) => item.key),
                },
            },
        });
    }
    return record;
}
export async function importMailLibrary(input) {
    const templates = input.templates || [];
    const recipientGroups = input.recipientGroups || [];
    const schedules = input.schedules || [];
    for (const item of templates) {
        await upsertMailTemplate(item);
    }
    for (const item of recipientGroups) {
        await upsertMailRecipientGroup(item);
    }
    for (const item of schedules) {
        await upsertMailSchedule(item);
    }
    return {
        templates: templates.length,
        recipientGroups: recipientGroups.length,
        schedules: schedules.length,
    };
}
//# sourceMappingURL=mailLibraryService.js.map