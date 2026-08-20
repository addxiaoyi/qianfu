import { z } from 'zod';
export declare const newsSubmissionStatusSchema: z.ZodEnum<{
    APPROVED: "APPROVED";
    REJECTED: "REJECTED";
    PENDING: "PENDING";
}>;
export declare const newsSubmissionCreateSchema: z.ZodObject<{
    title: z.ZodString;
    message: z.ZodString;
}, z.core.$strict>;
export declare const rejectionReasonSchema: z.ZodObject<{
    reason: z.ZodString;
}, z.core.$strict>;
export declare const newsSubmissionIdSchema: z.ZodString;
export type NewsSubmissionInput = z.infer<typeof newsSubmissionCreateSchema>;
export type NewsSubmissionStatus = z.infer<typeof newsSubmissionStatusSchema>;
export interface NewsSubmissionView {
    id: string;
    userId: number;
    authorName: string | null;
    title: string;
    message: string;
    status: NewsSubmissionStatus;
    rejectionReason: string | null;
    announcementId: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare function listOwnNewsSubmissions(userId: number): Promise<NewsSubmissionView[]>;
export declare function createNewsSubmission(userId: number, input: NewsSubmissionInput): Promise<NewsSubmissionView>;
export declare function updateOwnNewsSubmission(userId: number, id: string, input: NewsSubmissionInput): Promise<NewsSubmissionView>;
export declare function listNewsSubmissionsForReview(): Promise<NewsSubmissionView[]>;
export declare function approveNewsSubmission(id: string, adminId: number): Promise<NewsSubmissionView>;
export declare function rejectNewsSubmission(id: string, adminId: number, rejectionReason: string): Promise<NewsSubmissionView>;
//# sourceMappingURL=newsSubmissionService.d.ts.map