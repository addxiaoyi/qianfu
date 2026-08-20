import { getEffectiveMailRuntime } from './mailConfigService.js';
export type MailAddress = {
    name: string;
    address: string;
};
export type InboxAttachment = {
    filename: string;
    contentType: string;
    size: number;
    cid?: string;
};
export type InboxMessage = {
    id: string;
    uid: number;
    subject: string;
    from: MailAddress[];
    to: MailAddress[];
    date: string;
    unread: boolean;
    hasAttachments: boolean;
    preview: string;
    text: string;
    html: string;
    messageId?: string;
    references: string[];
    attachments: InboxAttachment[];
};
export declare function resolveImapConfig(runtime: Awaited<ReturnType<typeof getEffectiveMailRuntime>>): {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    rejectUnauthorized: boolean;
};
export declare function normalizeReplySubject(subject: string): string;
export declare function buildReplyHeaders(message: InboxMessage): {
    inReplyTo?: string;
    references: string[];
};
export declare function buildInboxRange(total: number, page: number, pageSize: number): {
    start: number;
    end: number;
} | null;
export declare function listInbox(page?: number): Promise<{
    page: number;
    pageSize: number;
    total: number;
    messages: InboxMessage[];
}>;
export declare function getInboxMessage(uid: number): Promise<InboxMessage>;
//# sourceMappingURL=mailInboxService.d.ts.map