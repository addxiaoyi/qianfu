import { describe, expect, it, vi } from 'vitest';
import {
  getServerAvailability,
  getServerFreshnessLabel,
  getServerPlayerLabel,
  getServerPlatformLabel,
  getServerVersionLabels,
} from '../../qianfu-liandeng/src/utils/serverView';

describe('server discovery display model', () => {
  it('normalizes availability without treating missing status as online', () => {
    expect(getServerAvailability({ status: { online: true } })).toBe('online');
    expect(getServerAvailability({ status: { online: false } })).toBe('offline');
    expect(getServerAvailability({})).toBe('unknown');
  });

  it('formats player counts with an optional capacity', () => {
    expect(getServerPlayerLabel({ status: { playersOnline: 12, playersMax: 80 } })).toBe('12 / 80');
    expect(getServerPlayerLabel({ status: { playersOnline: 3 } })).toBe('3');
  });

  it('uses real platform and version fields with honest fallbacks', () => {
    expect(getServerPlatformLabel({ platform: 'bedrock' })).toBe('基岩版');
    expect(getServerPlatformLabel({ platform: 'java' })).toBe('Java版');
    expect(getServerVersionLabels({ supported_versions: '["1.21", "1.20.1"]' })).toEqual(['1.21', '1.20.1']);
    expect(getServerVersionLabels({})).toEqual([]);
  });

  it('reports status freshness from the probe timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T12:00:00.000Z'));
    expect(getServerFreshnessLabel({ status: { lastUpdated: '2026-08-13T11:58:00.000Z' } })).toBe('2 分钟前更新');
    expect(getServerFreshnessLabel({})).toBe('状态时间未知');
    vi.useRealTimers();
  });
});
