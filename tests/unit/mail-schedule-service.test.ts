import { describe, expect, it } from 'vitest';

import { normalizeMailLibrary } from '../../server/services/mailScheduleService';

describe('mail schedule persistence safety', () => {
  it('normalizes non-array persisted library fields to empty arrays', () => {
    const library = normalizeMailLibrary({
      templates: { key: 'broken' },
      history: 'broken',
      schedules: { key: 'broken' },
      recipientGroups: null,
    });

    expect(library.templates).toEqual([]);
    expect(library.history).toEqual([]);
    expect(library.schedules).toEqual([]);
    expect(library.recipientGroups).toEqual([]);
  });

  it('drops malformed persisted templates, history records, groups, and schedules', () => {
    const validSchedule = {
      key: 'daily-maintenance',
      name: 'Daily maintenance',
      enabled: true,
      mode: 'maintenance' as const,
      scheduleType: 'daily' as const,
      dailyTime: '09:00',
      recipients: ['admin@example.com'],
      subject: 'Maintenance',
      message: 'Maintenance starts soon.',
    };

    const library = normalizeMailLibrary({
      templates: [
        { key: 'welcome', name: 'Welcome', mode: 'product', subject: 'Hi', message: 'Hello' },
        { key: 42, name: 'Broken', mode: 'product', subject: 'Hi', message: 'Hello' },
      ],
      history: [
        {
          id: 'history-1',
          kind: 'broadcast',
          subject: 'Sent',
          messagePreview: 'Preview',
          recipients: ['admin@example.com'],
          totalRecipients: 1,
          source: 'smtp',
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        { id: 'history-2', kind: 'invalid', subject: null },
      ],
      recipientGroups: [
        { key: 'admins', name: 'Admins', recipients: ['admin@example.com'] },
        { key: 'broken', name: 'Broken', recipients: 'admin@example.com' },
      ],
      schedules: [validSchedule, { ...validSchedule, recipients: 'not-an-array' }, { key: 'missing-fields' }],
    });

    expect(library.templates).toHaveLength(1);
    expect(library.history).toHaveLength(1);
    expect(library.recipientGroups).toHaveLength(1);
    expect(library.schedules).toEqual([validSchedule]);
  });
});
