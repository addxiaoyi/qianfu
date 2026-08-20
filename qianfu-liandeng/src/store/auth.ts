import { useAuthStore } from './authStore';

export { useAuthStore };

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
