import { z } from 'zod';
export declare const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 20000;
export declare const announcementToneSchema: z.ZodEnum<{
    SUCCESS: "SUCCESS";
    INFO: "INFO";
    WARNING: "WARNING";
    CRITICAL: "CRITICAL";
}>;
export declare const announcementStatusSchema: z.ZodEnum<{
    PUBLISHED: "PUBLISHED";
    DRAFT: "DRAFT";
    ARCHIVED: "ARCHIVED";
}>;
export declare function isAllowedAnnouncementImageUrl(value: string): boolean;
export declare const announcementCreateSchema: z.ZodObject<{
    title: z.ZodString;
    message: z.ZodString;
    tone: z.ZodDefault<z.ZodEnum<{
        SUCCESS: "SUCCESS";
        INFO: "INFO";
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        PUBLISHED: "PUBLISHED";
        DRAFT: "DRAFT";
        ARCHIVED: "ARCHIVED";
    }>>;
    linkLabel: z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>;
    linkPath: z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>;
    startsAt: z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>;
    endsAt: z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>;
    priority: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    dismissible: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const announcementUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    tone: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        SUCCESS: "SUCCESS";
        INFO: "INFO";
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
    }>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        PUBLISHED: "PUBLISHED";
        DRAFT: "DRAFT";
        ARCHIVED: "ARCHIVED";
    }>>>;
    linkLabel: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>>;
    linkPath: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>>;
    startsAt: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>>;
    endsAt: z.ZodOptional<z.ZodPipe<z.ZodTransform<{} | null, unknown>, z.ZodNullable<z.ZodString>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    dismissible: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strict>;
export declare const announcementIdSchema: z.ZodString;
export interface AnnouncementRecord extends z.infer<typeof announcementCreateSchema> {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    createdBy: number;
    updatedBy: number;
}
export declare function isAnnouncementAllowedInPersonalFiling(announcement: Pick<AnnouncementRecord, 'title' | 'message' | 'linkLabel' | 'linkPath'>): boolean;
export declare function pickActiveAnnouncement(announcements: AnnouncementRecord[], now?: Date): AnnouncementRecord | null;
export declare function filterPublicAnnouncements(announcements: AnnouncementRecord[], now?: Date): AnnouncementRecord[];
export declare function listAnnouncements(): Promise<AnnouncementRecord[]>;
export declare function getAnnouncement(id: string): Promise<AnnouncementRecord | null>;
export declare function getCurrentAnnouncement(now?: Date): Promise<AnnouncementRecord | null>;
export declare function listPublicAnnouncements(now?: Date): Promise<AnnouncementRecord[]>;
export declare function createAnnouncement(input: z.infer<typeof announcementCreateSchema>, adminId: number): Promise<AnnouncementRecord>;
export declare function updateAnnouncement(id: string, patch: z.infer<typeof announcementUpdateSchema>, adminId: number): Promise<{
    before: AnnouncementRecord;
    after: AnnouncementRecord;
} | null>;
export declare function deleteAnnouncement(id: string): Promise<AnnouncementRecord | null>;
//# sourceMappingURL=announcementService.d.ts.map