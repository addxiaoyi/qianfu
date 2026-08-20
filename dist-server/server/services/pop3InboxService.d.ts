import type { InboxMessage } from './mailInboxService.js';
export declare function listPopInbox(page?: number): Promise<{
    page: number;
    pageSize: number;
    total: number;
    messages: InboxMessage[];
}>;
export declare function getPopMessage(number: number): Promise<InboxMessage>;
//# sourceMappingURL=pop3InboxService.d.ts.map