import { logger } from '../utils/logger';
import { listMailLibrary, type MailRecipientGroupRecord, type MailScheduleRecord, recordMailHistory, upsertMailSchedule } from './mailLibraryService';
import { sendAdminBroadcastEmail } from './emailService';

function getZonedDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}:${lookup.minute}`,
  };
}

function resolveScheduleRecipients(schedule: MailScheduleRecord, groups: MailRecipientGroupRecord[]) {
  const grouped = (schedule.recipientGroupKeys || [])
    .flatMap((key) => groups.find((group) => group.key === key)?.recipients || []);
  return Array.from(new Set([...(schedule.recipients || []), ...grouped].map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function isScheduleDue(schedule: MailScheduleRecord, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (schedule.scheduleType === 'once') {
    if (!schedule.onceAt) return false;
    if (schedule.lastRunAt) return false;
    return new Date(schedule.onceAt).getTime() <= now.getTime();
  }

  if (!schedule.dailyTime) return false;
  const timezone = schedule.timezone || 'Asia/Shanghai';
  const current = getZonedDateParts(now, timezone);
  if (current.time !== schedule.dailyTime) return false;
  if (!schedule.lastRunAt) return true;
  const last = getZonedDateParts(new Date(schedule.lastRunAt), timezone);
  return last.date !== current.date;
}

async function executeSchedule(schedule: MailScheduleRecord, groups: MailRecipientGroupRecord[]) {
  const recipients = resolveScheduleRecipients(schedule, groups);
  if (!recipients.length) {
    logger.warn('[MailSchedule] skipped schedule without recipients', { key: schedule.key });
    return;
  }

  const result = await sendAdminBroadcastEmail({
    recipients,
    subject: schedule.subject,
    message: schedule.message,
    mode: schedule.mode,
    ctaLabel: schedule.ctaLabel,
    ctaLink: schedule.ctaLink,
  });

  await recordMailHistory({
    kind: 'broadcast',
    mode: schedule.mode,
    subject: result.subject,
    messagePreview: schedule.message.slice(0, 240),
    recipients,
    totalRecipients: recipients.length,
    source: result.source,
    operator: `scheduler:${schedule.key}`,
  });

  await upsertMailSchedule({
    ...schedule,
    enabled: schedule.scheduleType === 'once' ? false : schedule.enabled,
    lastRunAt: new Date().toISOString(),
  });

  logger.info('[MailSchedule] schedule executed', {
    key: schedule.key,
    recipients: recipients.length,
    scheduleType: schedule.scheduleType,
  });
}

export class MailScheduleService {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = 60_000) {
    if (this.interval) return;
    logger.info(`[MailSchedule] Starting scheduler (${intervalMs}ms)`);
    this.interval = setInterval(() => {
      if (!this.running) {
        void this.tick();
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const library = await listMailLibrary();
      const schedules = library.schedules || [];
      if (!schedules.length) return;
      const now = new Date();
      for (const schedule of schedules) {
        if (!isScheduleDue(schedule, now)) continue;
        try {
          await executeSchedule(schedule, library.recipientGroups || []);
        } catch (error) {
          logger.error('[MailSchedule] schedule execution failed', {
            key: schedule.key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}

export const mailScheduleService = new MailScheduleService();
