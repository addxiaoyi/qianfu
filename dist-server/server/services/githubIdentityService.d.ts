export interface GitHubIdentityProfile {
    githubId: string;
    email: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
}
export declare class GitHubIdentityConflictError extends Error {
    readonly code = "GITHUB_IDENTITY_CONFLICT";
    constructor(message: string);
}
type ResolveUsername = (username?: string) => Promise<string>;
type PrismaLike = {
    $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
};
export declare function upsertGitHubIdentity(prisma: PrismaLike, rawProfile: GitHubIdentityProfile, resolveUsername: ResolveUsername): Promise<any>;
export {};
//# sourceMappingURL=githubIdentityService.d.ts.map