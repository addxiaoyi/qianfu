export declare const sendVerificationEmail: (email: string, token: string) => Promise<void>;
export declare const sendEmailLoginCode: (email: string, code: string) => Promise<void>;
/**
 * SuperTokens 默认链接多为 `/auth/reset-password?token=...`（会打到后端）。
 * 本站为 Hash 路由，改为 `/?token=...#/reset-password`，便于 SDK 从 location.search 读 token。
 */
export declare function toHashSpaPasswordResetLink(superTokensLink: string): string;
/** SuperTokens 生成的完整重置链接（含 token），经项目 SMTP 发出 */
export declare const sendSuperTokensPasswordResetEmail: (email: string, passwordResetLink: string) => Promise<void>;
export declare const sendPasswordResetEmail: (email: string, token: string) => Promise<void>;
export declare const sendTicketNotification: (ticket: any, user: any, adminEmails: string[]) => Promise<void>;
//# sourceMappingURL=emailService.d.ts.map