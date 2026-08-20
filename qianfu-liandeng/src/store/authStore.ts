import { create } from 'zustand';
import type { User } from '@/types/api';
import { api, ApiError, getFrontendApiBase, setLocalAuthToken } from '@/api/request';
import { normalizeUser } from '@/utils/user';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendReady: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (status: boolean) => void;
  setBackendReady: (ready: boolean) => void;
  logout: () => Promise<void>;
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
  logout: async () => {
    try {
      await api.post(
        isRustV2Enabled() ? rustV2Path('/auth/logout') : '/logout',
        undefined,
        isRustV2Enabled() ? rustV2RequestOptions : undefined,
      );
    } catch (error) {
      console.warn('[auth] Server logout failed; clearing local session state.', error);
    } finally {
      setLocalAuthToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false, backendReady: true });
    }
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
        const profile = isRustV2Enabled()
          ? normalizeUser(await api.get<User | null>(rustV2Path('/auth/me'), undefined, rustV2RequestOptions))
          : (await api.get<{ csrfToken: string }>('/csrf-token', undefined, { useAuth: false, skipCsrf: true }), normalizeUser(await api.get<User | null>('/session-profile')));
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
