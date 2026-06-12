import crypto from 'crypto';
import prisma from '../db';

const MAIL_TEMPLATE_PREFIX = 'mail_template:';
const MAIL_GROUP_PREFIX = 'mail_group:';
const MAIL_HISTORY_PREFIX = 'mail_history:';
const MAIL_SCHEDULE_PREFIX = 'mail_schedule:';
const MAIL_HISTORY_LIMIT = 100;

export type MailTemplateRecord = {
  key: string;
  name: string;
  mode: 'product' | 'maintenance' | 'custom';
  subject: string;
  message: string;
  ctaLabel?: string;
  ctaLink?: string;
  updatedAt?: string;
};

export type MailRecipientGroupRecord = {
  key: string;
  name: string;
  description?: string;
  recipients: string[];
  updatedAt?: string;
};

export type MailHistoryRecord = {
  id: string;
  kind: 'test' | 'broadcast';
  mode?: 'product' | 'maintenance' | 'custom';
  subject: string;
  messagePreview: string;
  recipients: string[];
  totalRecipients: number;
  source: string;
  operator?: string;
  createdAt: string;
};

export type MailScheduleRecord = {
  key: string;
  name: string;
  enabled: boolean;
  mode: 'product' | 'maintenance' | 'custom';
  scheduleType: 'once' | 'daily';
  onceAt?: string;
  dailyTime?: string;
  timezone?: string;
  recipients: string[];
  recipientGroupKeys?: string[];
  subject: string;
  message: string;
  ctaLabel?: string;
  ctaLink?: string;
  lastRunAt?: string;
  updatedAt?: string;
};

function normalizeKey(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new Error('invalid key');
  }
  return value;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function uniqueEmails(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

async function upsertJsonConfig(key: string, value: unknown, description: string) {
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
    .map((row) => parseJson<MailTemplateRecord>(row.value))
    .filter((row): row is MailTemplateRecord => Boolean(row));
  const recipientGroups = groupRows
    .map((row) => parseJson<MailRecipientGroupRecord>(row.value))
    .filter((row): row is MailRecipientGroupRecord => Boolean(row));
  const history = historyRows
    .map((row) => parseJson<MailHistoryRecord>(row.value))
    .filter((row): row is MailHistoryRecord => Boolean(row));
  const schedules = scheduleRows
    .map((row) => parseJson<MailScheduleRecord>(row.value))
    .filter((row): row is MailScheduleRecord => Boolean(row));

  return { templates, recipientGroups, history, schedules };
}

export async function upsertMailTemplate(input: Omit<MailTemplateRecord, 'updatedAt'>) {
  const key = normalizeKey(input.key);
  const record: MailTemplateRecord = {
    ...input,
    key,
    updatedAt: new Date().toISOString(),
  };
  await upsertJsonConfig(`${MAIL_TEMPLATE_PREFIX}${key}`, record, `Mail template ${key}`);
  return record;
}

export async function deleteMailTemplate(keyRaw: string) {
  const key = normalizeKey(keyRaw);
  await prisma.systemConfig.deleteMany({
    where: { key: `${MAIL_TEMPLATE_PREFIX}${key}` },
  });
}

export async function upsertMailRecipientGroup(input: Omit<MailRecipientGroupRecord, 'updatedAt'>) {
  const key = normalizeKey(input.key);
  const record: MailRecipientGroupRecord = {
    ...input,
    key,
    recipients: uniqueEmails(input.recipients),
    updatedAt: new Date().toISOString(),
  };
  await upsertJsonConfig(`${MAIL_GROUP_PREFIX}${key}`, record, `Mail recipient group ${key}`);
  return record;
}

export async function deleteMailRecipientGroup(keyRaw: string) {
  const key = normalizeKey(keyRaw);
  await prisma.systemConfig.deleteMany({
    where: { key: `${MAIL_GROUP_PREFIX}${key}` },
  });
}

export async function upsertMailSchedule(input: Omit<MailScheduleRecord, 'updatedAt'>) {
  const key = normalizeKey(input.key);
  const record: MailScheduleRecord = {
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

export async function deleteMailSchedule(keyRaw: string) {
  const key = normalizeKey(keyRaw);
  await prisma.systemConfig.deleteMany({
    where: { key: `${MAIL_SCHEDULE_PREFIX}${key}` },
  });
}

export async function recordMailHistory(input: Omit<MailHistoryRecord, 'id' | 'createdAt'>) {
  const id = crypto.randomUUID();
  const record: MailHistoryRecord = {
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

export async function importMailLibrary(input: {
  templates?: Array<Omit<MailTemplateRecord, 'updatedAt'>>;
  recipientGroups?: Array<Omit<MailRecipientGroupRecord, 'updatedAt'>>;
  schedules?: Array<Omit<MailScheduleRecord, 'updatedAt'>>;
}) {
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
