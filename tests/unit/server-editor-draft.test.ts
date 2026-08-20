import { describe, expect, it } from 'vitest';
import {
  clearServerEditorDraft,
  createServerEditorDraftAutosave,
  createServerEditorDraftPersistence,
  getServerEditorDraftFingerprint,
  loadServerEditorDraft,
  prepareServerEditorDraftForRemote,
  saveServerEditorDraft,
  type ServerEditorDraft,
} from '../../qianfu-liandeng/src/pages/serverEditorDraft';

const makeStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

const draft: ServerEditorDraft = {
  name: '测试服务器',
  version: '1.21.8',
  ip: '127.0.0.1:25565',
  platform: 'java',
  groupNumber: '',
  tags: '生存 社区',
  description: '<p>这是一个用于测试的服务器介绍。</p>',
  image: '/uploads/cover.png',
  listingPlan: 'free-monthly',
  freeDomainEnabled: false,
  freeDomainSuffixId: null,
  freeDomainPrefix: '',
};

describe('server editor draft storage', () => {
  it('keeps an unchanged form fingerprint stable across rerenders', () => {
    expect(getServerEditorDraftFingerprint(draft)).toBe(getServerEditorDraftFingerprint({ ...draft }));
  });

  it('debounces automatic saves and keeps only the latest form state', () => {
    let pending: (() => void) | undefined;
    let cancelled = 0;
    const saved: ServerEditorDraft[] = [];
    const autosave = createServerEditorDraftAutosave(800, {
      setTimeout: callback => {
        pending = callback;
        return 1;
      },
      clearTimeout: () => {
        cancelled += 1;
      },
    });

    autosave.schedule(() => saved.push({ ...draft, name: '第一次' }));
    autosave.schedule(() => saved.push({ ...draft, name: '最后一次' }));

    expect(saved).toEqual([]);
    expect(cancelled).toBe(1);
    pending?.();
    expect(saved.map(item => item.name)).toEqual(['最后一次']);
  });

  it('saves and restores a valid draft without requiring submit validation', () => {
    const storage = makeStorage();

    expect(saveServerEditorDraft(storage, draft)).toBe(true);
    expect(loadServerEditorDraft(storage)).toEqual(draft);
  });

  it('drops malformed fields and unknown listing plans when restoring', () => {
    const storage = makeStorage();
    storage.setItem('qianfu:server-editor:draft:v1', JSON.stringify({
      ...draft,
      name: 42,
      listingPlan: 'unknown',
      description: null,
    }));

    expect(loadServerEditorDraft(storage)).toEqual({
      ...draft,
      name: '',
      listingPlan: 'free-monthly',
      description: '',
    });
  });

  it('clears the draft after a successful submission', () => {
    const storage = makeStorage();
    saveServerEditorDraft(storage, draft);

    clearServerEditorDraft(storage);

    expect(loadServerEditorDraft(storage)).toBeNull();
  });

  it('uses the remote store when browser storage is unavailable', async () => {
    let remoteDraft: ServerEditorDraft | null = null;
    const persistence = createServerEditorDraftPersistence({
      load: async () => remoteDraft,
      save: async (_key, value) => {
        remoteDraft = value;
        return true;
      },
      clear: async () => {
        remoteDraft = null;
        return true;
      },
    }, null);

    expect(await persistence.save('create', draft)).toBe(true);
    expect(await persistence.load('create')).toEqual(draft);
    await persistence.clear('create');
    expect(remoteDraft).toBeNull();
  });

  it('does not send an inline image payload to the remote draft store', () => {
    const remoteDraft = prepareServerEditorDraftForRemote({
      ...draft,
      image: `data:image/png;base64,${'A'.repeat(3000)}`,
    });

    expect(remoteDraft.image).toBeNull();
  });

  it('serializes remote saves so an older request cannot finish after a newer one', async () => {
    const calls: string[] = [];
    const resolvers: Array<() => void> = [];
    const persistence = createServerEditorDraftPersistence({
      load: async () => null,
      save: async (_key, value) => {
        calls.push(value.name);
        await new Promise<void>(resolve => resolvers.push(resolve));
        return true;
      },
      clear: async () => true,
    }, null);

    const first = persistence.save('create', { ...draft, name: '旧草稿' });
    const second = persistence.save('create', { ...draft, name: '最新草稿' });

    await Promise.resolve();
    expect(calls).toEqual(['旧草稿']);

    resolvers.shift()?.();
    await first;
    await Promise.resolve();
    expect(calls).toEqual(['旧草稿', '最新草稿']);

    resolvers.shift()?.();
    await expect(second).resolves.toBe(true);
  });

  it('clears remotely only after queued saves finish', async () => {
    const calls: string[] = [];
    const resolvers: Array<() => void> = [];
    const persistence = createServerEditorDraftPersistence({
      load: async () => null,
      save: async () => {
        calls.push('save');
        await new Promise<void>(resolve => resolvers.push(resolve));
        return true;
      },
      clear: async () => {
        calls.push('clear');
        return true;
      },
    }, null);

    const saveRequest = persistence.save('create', draft);
    const clearRequest = persistence.clear('create');

    await Promise.resolve();
    expect(calls).toEqual(['save']);
    expect(await Promise.race([clearRequest.then(() => 'cleared'), Promise.resolve('pending')])).toBe('pending');

    resolvers.shift()?.();
    await expect(saveRequest).resolves.toBe(true);
    await expect(clearRequest).resolves.toBe(true);
    expect(calls).toEqual(['save', 'clear']);
  });
});
