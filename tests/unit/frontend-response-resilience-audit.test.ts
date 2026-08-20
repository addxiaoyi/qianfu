import { describe, expect, it } from 'vitest';

import {
  normalizeNewsResponse,
  normalizeServerListResponse,
  normalizeAuditStatsResponse,
  normalizeAuditTimeseriesResponse,
} from '../../qianfu-liandeng/src/utils/frontendResponseNormalization';

describe('frontend API response resilience', () => {
  it('uses an empty news list when the announcements response is not an array', () => {
    expect(normalizeNewsResponse({ announcements: { id: 'not-a-list' } })).toEqual([]);
  });

  it('uses an empty server list when the public servers response is not an array', () => {
    expect(normalizeServerListResponse({ servers: { id: 'not-a-list' } })).toEqual([]);
  });

  it('uses safe audit collections when aggregate fields are malformed', () => {
    expect(normalizeAuditStatsResponse({ eventsByType: null, topUsers: { id: 1 } })).toMatchObject({
      eventsByType: {},
      topUsers: [],
    });
  });

  it('drops audit timeseries rows whose time is not a string', () => {
    expect(normalizeAuditTimeseriesResponse([
      { time: { value: '2026-08-12T00:00:00.000Z' }, count: 2 },
      { time: '2026-08-12T01:00:00.000Z', count: 3 },
    ])).toEqual([{ time: '2026-08-12T01:00:00.000Z', count: 3 }]);
  });
});
