export declare function sendDiagnosticEmail(to: string, subject: string, message: string): Promise<void>;
export declare function sendAdminBroadcastEmail(options: {
    recipients: string[];
    subject: string;
    message: string;
    mode?: 'product' | 'maintenance' | 'custom';
    ctaLabel?: string;
    ctaLink?: string;
}): Promise<{
    total: number;
    batches: number;
    subject: string;
    source: string;
}>;
export declare const sendVerificationEmail: (email: string, token: string) => Promise<void>;
export declare const sendEmailLoginCode: (email: string, code: string) => Promise<void>;
export declare function toHashSpaPasswordResetLink(superTokensLink: string): string;
export declare const sendSuperTokensPasswordResetEmail: (email: string, passwordResetLink: string) => Promise<void>;
export declare const sendPasswordResetEmail: (email: string, token: string, code?: string) => Promise<void>;
export declare const sendTicketNotification: (ticket: any, user: any, adminEmails: string[]) => Promise<void>;
//# sourceMappingURL=emailService.d.ts.map