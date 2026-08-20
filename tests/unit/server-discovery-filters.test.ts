import { describe, expect, it } from 'vitest';
import {
  getDiscoveryQuery,
  mergeDiscoveryFilters,
  readDiscoveryFilters,
  toDiscoverySearchParams,
  type DiscoveryFilters,
} from '../../qianfu-liandeng/src/utils/serverDiscovery';

describe('server discovery URL filters', () => {
  it('reads shareable filters and derives the active intent', () => {
    const filters = readDiscoveryFilters(new URLSearchParams('search=星辰&category=生存&platform=java&version=1.21&online=true'));

    expect(filters).toMatchObject({
      search: '星辰',
      category: '生存',
      platform: 'java',
      version: '1.21',
      online: 'true',
      intent: 'online',
    });
  });

  it('maps intent and filters to the existing public server query contract', () => {
    const filters: DiscoveryFilters = {
      intent: 'players',
      search: '',
      category: '小游戏',
      platform: '',
      version: '',
      online: '',
      sortBy: 'players',
    };

    expect(getDiscoveryQuery(filters)).toEqual({
      category: '小游戏',
      sortBy: 'players',
      sortOrder: 'desc',
      limit: 60,
    });
  });

  it('does not carry the online shortcut into the all-server directory', () => {
    const filters = mergeDiscoveryFilters({
      intent: 'players',
      search: '',
      category: '',
      platform: '',
      version: '',
      online: '',
      sortBy: 'players',
    }, { intent: 'all' });
    const params = toDiscoverySearchParams(filters);

    expect(params.toString()).toBe('');
  });

  it('keeps an explicit online status selected in the all-server directory', () => {
    const filters = mergeDiscoveryFilters({
      intent: 'online',
      search: '',
      category: '',
      platform: '',
      version: '',
      online: 'true',
      sortBy: 'activity',
    }, { intent: 'all', online: 'false' });

    expect(filters).toMatchObject({ intent: 'all', online: 'false', sortBy: 'activity' });
    expect(toDiscoverySearchParams(filters).toString()).toBe('online=false');
  });
});
