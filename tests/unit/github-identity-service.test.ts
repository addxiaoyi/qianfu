import { describe, expect, it } from 'vitest';
import { GitHubIdentityConflictError, upsertGitHubIdentity } from '../../server/services/githubIdentityService';

type UserRow = Record<string, any> & { id: number; email: string; email_verified: boolean; github_user_id?: string | null };

class FakePrisma {
  users: UserRow[];
  private nextId: number;

  constructor(users: UserRow[] = []) {
    this.users = users.map((user) => ({ login_count: 0, ...user }));
    this.nextId = Math.max(0, ...this.users.map((user) => user.id)) + 1;
  }

  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id !== undefined) return this.users.find((user) => user.id === where.id) || null;
          if (where.email !== undefined) return this.users.find((user) => user.email === where.email) || null;
          if (where.github_user_id !== undefined) return this.users.find((user) => user.github_user_id === where.github_user_id) || null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const user = this.users.find((item) => item.id === where.id);
          if (!user) throw new Error('missing user');
          for (const [key, value] of Object.entries(data)) {
            if (key === 'login_count' && value && typeof value === 'object' && 'increment' in value) {
              user.login_count = Number(user.login_count || 0) + Number((value as any).increment);
            } else {
              user[key] = value;
            }
          }
          return { ...user };
        },
        create: async ({ data }: any) => {
          const user = { id: this.nextId++, ...data } as UserRow;
          this.users.push(user);
          return { ...user };
        },
      },
    };
    return callback(tx);
  }
}

const resolveUsername = async (username?: string) => username || 'github-user';
const profile = {
  githubId: '10001',
  email: 'verified@example.com',
  username: 'octocat',
  displayName: 'Octo Cat',
  avatarUrl: 'https://avatars.example/1.png',
};

describe('GitHub stable identity linking', () => {
  it('uses provider ID as the primary identity when the verified email changes', async () => {
    const db = new FakePrisma([{ id: 7, email: 'old@example.com', email_verified: true, github_user_id: '10001', username: 'old' }]);
    const user = await upsertGitHubIdentity(db, profile, resolveUsername);
    expect(user.id).toBe(7);
    expect(user.email).toBe('verified@example.com');
    expect(db.users).toHaveLength(1);
  });

  it('rejects an email change that would collide with another local account', async () => {
    const db = new FakePrisma([
      { id: 7, email: 'old@example.com', email_verified: true, github_user_id: '10001' },
      { id: 8, email: 'verified@example.com', email_verified: true, github_user_id: null },
    ]);
    await expect(upsertGitHubIdentity(db, profile, resolveUsername)).rejects.toBeInstanceOf(GitHubIdentityConflictError);
  });

  it('does not auto-link an unverified local email account', async () => {
    const db = new FakePrisma([{ id: 8, email: 'verified@example.com', email_verified: false, github_user_id: null }]);
    await expect(upsertGitHubIdentity(db, profile, resolveUsername)).rejects.toThrow('Verify the existing local account');
  });

  it('links an already verified local email account', async () => {
    const db = new FakePrisma([{ id: 8, email: 'verified@example.com', email_verified: true, github_user_id: null }]);
    const user = await upsertGitHubIdentity(db, profile, resolveUsername);
    expect(user.id).toBe(8);
    expect(user.github_user_id).toBe('10001');
  });

  it('creates a new account with the immutable provider ID', async () => {
    const db = new FakePrisma();
    const user = await upsertGitHubIdentity(db, profile, resolveUsername);
    expect(user.github_user_id).toBe('10001');
    expect(user.email_verified).toBe(true);
  });
});
