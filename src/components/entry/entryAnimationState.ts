export const ENTRY_ANIMATION_STORAGE_KEY = 'qianfu.entry-animation.v1';

export type EntryAnimationStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
};

export const readEntryAnimationStorage = (): EntryAnimationStorage | null => {
  if (typeof window === 'undefined') return null;

  try {
    const storage = window.sessionStorage;
    return {
      get: (key) => storage.getItem(key),
      set: (key, value) => storage.setItem(key, value),
    };
  } catch {
    return null;
  }
};

export const shouldPlayEntryAnimation = (
  storage: EntryAnimationStorage | null,
  prefersReducedMotion: boolean,
) => {
  if (prefersReducedMotion) return false;

  try {
    return storage?.get(ENTRY_ANIMATION_STORAGE_KEY) !== 'played';
  } catch {
    return true;
  }
};

export const markEntryAnimationPlayed = (storage: EntryAnimationStorage | null) => {
  try {
    storage?.set(ENTRY_ANIMATION_STORAGE_KEY, 'played');
  } catch {
    // A blocked sessionStorage must never prevent the page from loading.
  }
};
