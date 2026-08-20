export interface GitHubIdentityProfile {
  githubId: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

export class GitHubIdentityConflictError extends Error {
  readonly code = 'GITHUB_IDENTITY_CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'GitHubIdentityConflictError';
  }
}

type ResolveUsername = (username?: string) => Promise<string>;

type PrismaLike = {
  $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
};

function normalizeProfile(profile: GitHubIdentityProfile): GitHubIdentityProfile {
  const githubId = String(profile.githubId || '').trim();
  const email = String(profile.email || '').trim().toLowerCase();
  if (!/^\d+$/.test(githubId)) throw new GitHubIdentityConflictError('Invalid GitHub provider identity');
  if (!email || !email.includes('@')) throw new GitHubIdentityConflictError('GitHub did not provide a verified email');
  return { ...profile, githubId, email };
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

export async function upsertGitHubIdentity(
  prisma: PrismaLike,
  rawProfile: GitHubIdentityProfile,
  resolveUsername: ResolveUsername,
) {
  const profile = normalizeProfile(rawProfile);
  try {
    return await prisma.$transaction(async (tx) => {
      const existingByProvider = await tx.user.findUnique({
        where: { github_user_id: profile.githubId },
      });

      if (existingByProvider) {
        const emailOwner = await tx.user.findUnique({ where: { email: profile.email } });
        if (emailOwner && emailOwner.id !== existingByProvider.id) {
          throw new GitHubIdentityConflictError('GitHub verified email belongs to another local account');
        }
        return tx.user.update({
          where: { id: existingByProvider.id },
          data: {
            email: profile.email,
            email_verified: true,
            avatar_url: existingByProvider.avatar_url || profile.avatarUrl,
            display_name: existingByProvider.display_name || profile.displayName,
            username: existingByProvider.username || (await resolveUsername(profile.username)),
            last_login_at: new Date(),
            login_count: { increment: 1 },
          },
        });
      }

      const existingByEmail = await tx.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        if (!existingByEmail.email_verified) {
          throw new GitHubIdentityConflictError('Verify the existing local account before linking GitHub');
        }
        if (existingByEmail.github_user_id && existingByEmail.github_user_id !== profile.githubId) {
          throw new GitHubIdentityConflictError('Local account is already linked to another GitHub identity');
        }
        return tx.user.update({
          where: { id: existingByEmail.id },
          data: {
            github_user_id: profile.githubId,
            avatar_url: existingByEmail.avatar_url || profile.avatarUrl,
            display_name: existingByEmail.display_name || profile.displayName,
            username: existingByEmail.username || (await resolveUsername(profile.username)),
            last_login_at: new Date(),
            login_count: { increment: 1 },
          },
        });
      }

      return tx.user.create({
        data: {
          github_user_id: profile.githubId,
          email: profile.email,
          email_verified: true,
          username: await resolveUsername(profile.username),
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          role: 'NORMAL',
          last_login_at: new Date(),
          login_count: 1,
        },
      });
    });
  } catch (error) {
    if (error instanceof GitHubIdentityConflictError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new GitHubIdentityConflictError('GitHub identity or verified email is already linked');
    }
    throw error;
  }
}
