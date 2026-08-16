import { describe, expect, it } from 'vitest';
import {
  ENTRY_ANIMATION_STORAGE_KEY,
  markEntryAnimationPlayed,
  shouldPlayEntryAnimation,
  type EntryAnimationStorage,
} from '@/components/entry/entryAnimationState';

const createStorage = (entries: Record<string, string> = {}): EntryAnimationStorage => {
  const values = new Map(Object.entries(entries));
  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => values.set(key, value),
  };
};

describe('entry animation state', () => {
  it('plays once when the session has no completion marker', () => {
    const storage = createStorage();

    expect(shouldPlayEntryAnimation(storage, false)).toBe(true);

    markEntryAnimationPlayed(storage);
    expect(storage.get(ENTRY_ANIMATION_STORAGE_KEY)).toBe('played');
  });

  it('does not play again after completion or when reduced motion is enabled', () => {
    const storage = createStorage({ [ENTRY_ANIMATION_STORAGE_KEY]: 'played' });

    expect(shouldPlayEntryAnimation(storage, false)).toBe(false);
    expect(shouldPlayEntryAnimation(createStorage(), true)).toBe(false);
  });

  it('fails open when storage read or write throws', () => {
    const throwingStorage: EntryAnimationStorage = {
      get: () => {
        throw new Error('storage blocked');
      },
      set: () => {
        throw new Error('storage blocked');
      },
    };

    expect(shouldPlayEntryAnimation(throwingStorage, false)).toBe(true);
    expect(() => markEntryAnimationPlayed(throwingStorage)).not.toThrow();
  });
});
