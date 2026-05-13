import { create } from 'zustand';
import type { User } from '@/types/api';
import { api, getFrontendApiBase } from '@/api/request';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendReady: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (status: boolean) => void;
  setBackendReady: (ready: boolean) => void;
  logout: () => void;
  hydrateFromSession: () => Promise<void>;
}

let hydratePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  backendReady: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false, backendReady: true }),
  setAuthenticated: (status) => set({ isAuthenticated: status, isLoading: false }),
  setBackendReady: (ready) => set({ backendReady: ready }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
  hydrateFromSession: async () => {
    if (get().user) {
      set({ isLoading: false, backendReady: true });
      return;
    }
    if (hydratePromise) return hydratePromise;
    set({ isLoading: true });
    hydratePromise = (async () => {
      try {
        await api.get<{ csrfToken: string }>('/csrf-token', undefined, { useAuth: false, skipCsrf: true });
        const profile = await api.get<User>('/profile');
        set({ user: profile, isAuthenticated: true, isLoading: false, backendReady: true });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false, backendReady: false });
        if (typeof window !== 'undefined') {
          console.warn(`[auth] Backend unavailable at ${getFrontendApiBase()}, auth state loaded in offline mode.`);
        }
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  },
}));
