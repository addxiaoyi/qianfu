export type DiscoveryIntent = 'online' | 'players' | 'created' | 'all';
export type DiscoverySort = 'activity' | 'players' | 'created';

export interface DiscoveryFilters {
  intent: DiscoveryIntent;
  search: string;
  category: string;
  platform: '' | 'java' | 'bedrock';
  version: string;
  online: '' | 'true' | 'false';
  sortBy: DiscoverySort;
}

const allowedIntents = new Set<DiscoveryIntent>(['online', 'players', 'created', 'all']);
const allowedPlatforms = new Set<DiscoveryFilters['platform']>(['', 'java', 'bedrock']);
const allowedOnline = new Set<DiscoveryFilters['online']>(['', 'true', 'false']);
const allowedSorts = new Set<DiscoverySort>(['activity', 'players', 'created']);

const readAllowed = <T extends string>(value: string | null, allowed: Set<T>, fallback: T) => {
  return value && allowed.has(value as T) ? (value as T) : fallback;
};

const intentFromParams = (params: URLSearchParams): DiscoveryIntent => {
  const explicitIntent = params.get('intent');
  if (explicitIntent && allowedIntents.has(explicitIntent as DiscoveryIntent)) {
    return explicitIntent as DiscoveryIntent;
  }

  if (params.get('online') === 'true') return 'online';
  if (params.get('sortBy') === 'players') return 'players';
  if (params.get('sortBy') === 'created') return 'created';
  return 'all';
};

const sortForIntent = (intent: DiscoveryIntent, rawSort: string | null): DiscoverySort => {
  if (intent === 'players') return 'players';
  if (intent === 'created') return 'created';
  if (intent === 'online') return 'activity';
  return readAllowed(rawSort, allowedSorts, 'activity');
};

export const readDiscoveryFilters = (params: URLSearchParams): DiscoveryFilters => {
  const intent = intentFromParams(params);
  const online = readAllowed(params.get('online'), allowedOnline, '');

  return {
    intent,
    search: params.get('search')?.trim() || '',
    category: params.get('category')?.trim() || '',
    platform: readAllowed(params.get('platform'), allowedPlatforms, ''),
    version: params.get('version')?.trim() || '',
    online: intent === 'online' ? 'true' : online,
    sortBy: sortForIntent(intent, params.get('sortBy')),
  };
};

export const getDiscoveryQuery = (filters: DiscoveryFilters) => ({
  ...(filters.search ? { search: filters.search } : {}),
  ...(filters.category ? { category: filters.category } : {}),
  ...(filters.platform ? { platform: filters.platform } : {}),
  ...(filters.version ? { version: filters.version } : {}),
  ...(filters.online ? { online: filters.online } : {}),
  sortBy: filters.sortBy,
  sortOrder: 'desc',
  limit: 60,
});

export const mergeDiscoveryFilters = (
  current: DiscoveryFilters,
  patch: Partial<DiscoveryFilters>,
): DiscoveryFilters => {
  const next = { ...current, ...patch };
  if (patch.intent === 'all' && current.intent !== 'all') {
    if (!Object.prototype.hasOwnProperty.call(patch, 'online')) next.online = '';
    if (!Object.prototype.hasOwnProperty.call(patch, 'sortBy')) next.sortBy = 'activity';
  }
  return next;
};

export const toDiscoverySearchParams = (filters: DiscoveryFilters) => {
  const params = new URLSearchParams();
  if (filters.intent !== 'all') params.set('intent', filters.intent);
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.version) params.set('version', filters.version);
  if (filters.intent === 'all' && filters.online) params.set('online', filters.online);
  if (filters.intent === 'all' && filters.sortBy !== 'activity') params.set('sortBy', filters.sortBy);
  return params;
};
