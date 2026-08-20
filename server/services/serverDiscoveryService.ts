export type DiscoveryServer = {
  activity?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  listing_plan?: string | null;
  listing_expires_at?: Date | string | null;
  status?: {
    online?: boolean | null;
    playersOnline?: number | null;
  } | null;
};

const finiteNonNegative = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const isPromotionActive = (server: DiscoveryServer, now = Date.now()) => {
  void server;
  void now;
  return false;
};

export const buildDiscoverySeed = (filterKey: string, discoveryWindow: number): string =>
  `${filterKey}:${discoveryWindow}`;

export const getDiscoveryWeight = (server: DiscoveryServer, _now = Date.now()) => {
  const activity = finiteNonNegative(server.activity);
  const players = finiteNonNegative(server.status?.playersOnline);
  const likes = finiteNonNegative(server.like_count);
  const comments = finiteNonNegative(server.comment_count);

  // Logarithmic terms keep a large server influential without making smaller servers invisible.
  const heat = 1 + Math.log1p(activity) * 0.35 + Math.log1p(likes + comments * 2) * 0.2;
  const playerPresence = server.status?.online ? 1 + Math.log1p(players) * 0.45 : 1;
  return Math.max(0.01, heat * playerPresence);
};

export const weightedShuffle = <T extends DiscoveryServer>(
  servers: readonly T[],
  random = Math.random,
  now = Date.now(),
) => {
  const remaining = servers.map((server, index) => ({ server, index }));
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const totalWeight = remaining.reduce(
      (sum, item) => sum + getDiscoveryWeight(item.server, now),
      0,
    );
    let cursor = Math.min(1, Math.max(0, random())) * totalWeight;
    let selected = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      cursor -= getDiscoveryWeight(remaining[index].server, now);
      if (cursor <= 0) {
        selected = index;
        break;
      }
    }

    ordered.push(remaining[selected].server);
    remaining.splice(selected, 1);
  }

  return ordered;
};

export const createSeededRandom = (seed: string) => {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
