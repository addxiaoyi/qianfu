import { safeJsonParse } from '@/utils/json';
export const SERVER_EDITOR_DRAFT_KEY = 'qianfu:server-editor:draft:v1';

const LISTING_PLANS = ['free-monthly'] as const;

export type ListingPlan = typeof LISTING_PLANS[number];

export type ServerEditorDraft = {
  name: string;
  version: string;
  ip: string;
  platform: 'java' | 'bedrock';
  groupNumber: string;
  tags: string;
  description: string;
  image: string | null;
  listingPlan: ListingPlan;
  freeDomainEnabled: boolean;
  freeDomainSuffixId: number | null;
  freeDomainPrefix: string;
};

export const getServerEditorDraftFingerprint = (draft: ServerEditorDraft): string => JSON.stringify([
  draft.name,
  draft.version,
  draft.ip,
  draft.platform,
  draft.groupNumber,
  draft.tags,
  draft.description,
  draft.image,
  draft.listingPlan,
  draft.freeDomainEnabled,
  draft.freeDomainSuffixId,
  draft.freeDomainPrefix,
]);

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type TimerApi = Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

export type ServerEditorDraftRemoteStore = {
  load: (key: string) => Promise<ServerEditorDraft | null>;
  save: (key: string, draft: ServerEditorDraft) => Promise<boolean>;
  clear: (key: string) => Promise<boolean>;
};

const getStorage = (): DraftStorage | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

export const getServerEditorDraftKey = (serverId?: string | null): string => (
  serverId ? `${SERVER_EDITOR_DRAFT_KEY}:${serverId}` : SERVER_EDITOR_DRAFT_KEY
);

const asText = (value: unknown): string => typeof value === 'string' ? value : '';

const asImage = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value : null
);

const asListingPlan = (value: unknown): ListingPlan => (
  typeof value === 'string' && LISTING_PLANS.includes(value as ListingPlan)
    ? value as ListingPlan
    : 'free-monthly'
);

const normalizeDraft = (value: unknown): ServerEditorDraft | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  return {
    name: asText(source.name),
    version: asText(source.version),
    ip: asText(source.ip),
    platform: source.platform === 'bedrock' ? 'bedrock' : 'java',
    groupNumber: asText(source.groupNumber),
    tags: asText(source.tags),
    description: asText(source.description),
    image: asImage(source.image),
    listingPlan: asListingPlan(source.listingPlan),
    freeDomainEnabled: source.freeDomainEnabled === true,
    freeDomainSuffixId: typeof source.freeDomainSuffixId === 'number' ? source.freeDomainSuffixId : null,
    freeDomainPrefix: asText(source.freeDomainPrefix),
  };
};

export const loadServerEditorDraft = (
  storage: DraftStorage | null = getStorage(),
  key = SERVER_EDITOR_DRAFT_KEY,
): ServerEditorDraft | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeDraft(safeJsonParse(raw, {})) : null;
  } catch {
    return null;
  }
};

export const saveServerEditorDraft = (
  storage: DraftStorage | null,
  draft: ServerEditorDraft,
  key = SERVER_EDITOR_DRAFT_KEY,
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(normalizeDraft(draft)));
    return true;
  } catch {
    return false;
  }
};

export const prepareServerEditorDraftForRemote = (draft: ServerEditorDraft): ServerEditorDraft => ({
  ...draft,
  image: draft.image?.startsWith('data:image/') ? null : draft.image,
});

export const clearServerEditorDraft = (
  storage: DraftStorage | null = getStorage(),
  key = SERVER_EDITOR_DRAFT_KEY,
): void => {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or after quota changes.
  }
};

export const createServerEditorDraftAutosave = (
  delayMs: number,
  timer: TimerApi = globalThis,
) => {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  return {
    schedule(save: () => void): void {
      if (timerId !== undefined) timer.clearTimeout(timerId);
      timerId = timer.setTimeout(() => {
        timerId = undefined;
        save();
      }, delayMs);
    },
    cancel(): void {
      if (timerId === undefined) return;
      timer.clearTimeout(timerId);
      timerId = undefined;
    },
  };
};

export const createServerEditorDraftPersistence = (
  remote: ServerEditorDraftRemoteStore | null = null,
  storage: DraftStorage | null = getStorage(),
) => {
  let saveTail = Promise.resolve();

  const persistence = {
    async load(key: string): Promise<ServerEditorDraft | null> {
    const localDraft = loadServerEditorDraft(storage, key);
    if (localDraft) return localDraft;
    if (!remote) return null;
    try {
      const remoteDraft = await remote.load(key);
      if (remoteDraft) saveServerEditorDraft(storage, remoteDraft, key);
      return remoteDraft;
    } catch {
      return null;
    }
    },
    async save(key: string, draft: ServerEditorDraft): Promise<boolean> {
      const localSaved = saveServerEditorDraft(storage, draft, key);
      if (!remote) return localSaved;

      const saveRequest = saveTail.then(async () => {
        try {
          const remoteSaved = await remote.save(key, prepareServerEditorDraftForRemote(draft));
          return remoteSaved || localSaved;
        } catch {
          return localSaved;
        }
      });
      saveTail = saveRequest.then(() => undefined, () => undefined);
      return saveRequest;
    },
    async clear(key: string): Promise<boolean> {
      clearServerEditorDraft(storage, key);
      if (!remote) return true;
      const clearRequest = saveTail.then(async () => {
        try {
          return await remote.clear(key);
        } catch {
          return false;
        }
      });
      saveTail = clearRequest.then(() => undefined, () => undefined);
      return clearRequest;
    },
  };

  return persistence;
};
