export const SERVER_FACET_KIND = {
  TAG: 'TAG',
  VERSION: 'VERSION',
  NETWORK_ENV: 'NETWORK_ENV',
} as const;

export type ServerFacetKind = typeof SERVER_FACET_KIND[keyof typeof SERVER_FACET_KIND];

const MAX_FACET_VALUE_LENGTH = 96;
const FACET_LABEL_KEYS = ['label', 'name', 'title', 'value', 'tag'] as const;

export type ServerFacetInput = {
  tags?: unknown;
  supportedVersions?: unknown;
  networkEnv?: unknown;
};

export type ServerFacetRecord = {
  server_id: number;
  kind: ServerFacetKind;
  value: string;
  normalized_value: string;
};

type ServerFacetClient = {
  serverFacet: {
    deleteMany(args: { where: { server_id: number } }): Promise<unknown>;
    createMany(args: { data: ServerFacetRecord[] }): Promise<unknown>;
  };
};

export function normalizeFacetValue(value: string): string {
  return value.trim().toLowerCase();
}

function readFacetLabel(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of FACET_LABEL_KEYS) {
    const label = readFacetLabel(record[key]);
    if (label) return label;
  }
  return null;
}

function normalizeFacetList(values: unknown[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of values) {
    const label = readFacetLabel(value);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export function parseFacetValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeFacetList(value);
  }

  if (value && typeof value === 'object') return normalizeFacetList([value]);

  if (typeof value !== 'string' || !value.trim()) return [];
  const source = value.trim();

  try {
    const parsed = JSON.parse(source) as unknown;
    return Array.isArray(parsed) ? normalizeFacetList(parsed) : normalizeFacetList([parsed]);
  } catch {
    // Legacy non-JSON values are handled by the delimiter fallback below.
  }

  return normalizeFacetList(source.split(/[\s,，;；]+/u));
}

export function buildServerFacets(serverId: number, input: ServerFacetInput): ServerFacetRecord[] {
  const groups: Array<[ServerFacetKind, unknown]> = [
    [SERVER_FACET_KIND.TAG, input.tags],
    [SERVER_FACET_KIND.VERSION, input.supportedVersions],
    [SERVER_FACET_KIND.NETWORK_ENV, input.networkEnv],
  ];
  const seen = new Set<string>();
  const records: ServerFacetRecord[] = [];

  for (const [kind, rawValue] of groups) {
    for (const rawItem of parseFacetValues(rawValue)) {
      const value = rawItem.slice(0, MAX_FACET_VALUE_LENGTH);
      const normalizedValue = normalizeFacetValue(value);
      if (!normalizedValue) continue;
      const key = `${kind}\u0000${normalizedValue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        server_id: serverId,
        kind,
        value,
        normalized_value: normalizedValue,
      });
    }
  }

  return records;
}

export async function replaceServerFacets(
  client: ServerFacetClient,
  serverId: number,
  input: ServerFacetInput,
): Promise<void> {
  const records = buildServerFacets(serverId, input);
  await client.serverFacet.deleteMany({ where: { server_id: serverId } });
  if (records.length > 0) {
    await client.serverFacet.createMany({ data: records });
  }
}
