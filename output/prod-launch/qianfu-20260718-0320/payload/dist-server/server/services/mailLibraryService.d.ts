export type MailTemplateRecord = {
    key: string;
    name: string;
    mode: 'product' | 'maintenance' | 'custom';
    subject: string;
    message: string;
    ctaLabel?: string;
    ctaLink?: string;
    updatedAt?: string;
};
export type MailRecipientGroupRecord = {
    key: string;
    name: string;
    description?: string;
    recipients: string[];
    updatedAt?: string;
};
export type MailHistoryRecord = {
    id: string;
    kind: 'test' | 'broadcast';
    mode?: 'product' | 'maintenance' | 'custom';
    subject: string;
    messagePreview: string;
    recipients: string[];
    totalRecipients: number;
    source: string;
    operator?: string;
    createdAt: string;
};
export type MailScheduleRecord = {
    key: string;
    name: string;
    enabled: boolean;
    mode: 'product' | 'maintenance' | 'custom';
    scheduleType: 'once' | 'daily';
    onceAt?: string;
    dailyTime?: string;
    timezone?: string;
    recipients: string[];
    recipientGroupKeys?: string[];
    subject: string;
    message: string;
    ctaLabel?: string;
    ctaLink?: string;
    lastRunAt?: string;
    updatedAt?: string;
};
export declare function listMailLibrary(): Promise<{
    templates: MailTemplateRecord[];
    recipientGroups: MailRecipientGroupRecord[];
    history: MailHistoryRecord[];
    schedules: MailScheduleRecord[];
}>;
export declare function upsertMailTemplate(input: Omit<MailTemplateRecord, 'updatedAt'>): Promise<MailTemplateRecord>;
export declare function deleteMailTemplate(keyRaw: string): Promise<void>;
export declare function upsertMailRecipientGroup(input: Omit<MailRecipientGroupRecord, 'updatedAt'>): Promise<MailRecipientGroupRecord>;
export declare function deleteMailRecipientGroup(keyRaw: string): Promise<void>;
export declare function upsertMailSchedule(input: Omit<MailScheduleRecord, 'updatedAt'>): Promise<MailScheduleRecord>;
export declare function deleteMailSchedule(keyRaw: string): Promise<void>;
export declare function recordMailHistory(input: Omit<MailHistoryRecord, 'id' | 'createdAt'>): Promise<MailHistoryRecord>;
export declare function importMailLibrary(input: {
    templates?: Array<Omit<MailTemplateRecord, 'updatedAt'>>;
    recipientGroups?: Array<Omit<MailRecipientGroupRecord, 'updatedAt'>>;
    schedules?: Array<Omit<MailScheduleRecord, 'updatedAt'>>;
}): Promise<{
    templates: number;
    recipientGroups: number;
    schedules: number;
}>;
//# sourceMappingURL=mailLibraryService.d.ts.map