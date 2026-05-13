/// <reference types="vitest/globals" />
import { beforeEach } from 'vitest';
import '@testing-library/jest-dom';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

vi.stubGlobal('localStorage', mockLocalStorage);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
