import { create } from 'zustand';
import type { User } from '@/types/api';
import { api, ApiError, getFrontendApiBase, getLocalAuthToken, setLocalAuthToken } from '@/api/request';
import { normalizeUser } from '@/utils/user';

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
  setUser: (user) => {
    const normalizedUser = normalizeUser(user);
    set({ user: normalizedUser, isAuthenticated: !!normalizedUser, isLoading: false, backendReady: true });
  },
  setAuthenticated: (status) => set({ isAuthenticated: status, isLoading: false }),
  setBackendReady: (ready) => set({ backendReady: ready }),
  logout: () => {
    const token = getLocalAuthToken();
    void fetch('/api/v1/logout', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
    setLocalAuthToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false, backendReady: true });
  },
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
        const profile = normalizeUser(await api.get<User>('/profile'));
        set({ user: profile, isAuthenticated: !!profile, isLoading: false, backendReady: true });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          set({ user: null, isAuthenticated: false, isLoading: false, backendReady: true });
          return;
        }
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
