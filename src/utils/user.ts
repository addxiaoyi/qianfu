import type { User } from '@/types/api';

type NormalizableUser = Partial<User> & {
  id?: string | number | null;
  display_name?: string | null;
};

export function normalizeUser(user: NormalizableUser | null | undefined): User | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const rawRole = typeof user.role === 'string' ? user.role.toLowerCase() : 'user';
  const normalizedRole = rawRole === 'owner'
    ? 'super_admin'
    : rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'operator' || rawRole === 'moderator' || rawRole === 'normal'
      ? rawRole
      : 'user';

  return {
    ...user,
    id: user.id == null ? '' : String(user.id),
    username: user.username || user.display_name || user.email || '用户',
    role: normalizedRole,
  } as User;
}

export function formatUserId(id: unknown, length = 8): string {
  if (id === null || id === undefined || id === '') {
    return '—';
  }

  return String(id).slice(0, length);
}
