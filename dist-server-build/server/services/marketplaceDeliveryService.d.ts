import type { PrismaClient } from '../../prisma/generated/client/index.js';
export interface IssueMarketplaceDownloadInput {
    orderId: string;
    buyerId: number;
    ipAddress?: string | null;
    userAgent?: string | null;
}
export declare const issueMarketplaceDownload: (db: Pick<PrismaClient, "$transaction">, input: IssueMarketplaceDownloadInput) => Promise<{
    downloadUrl: string;
    file: {
        version: string;
        sha256: string | null;
        size: number | null;
        mime: string | null;
    };
}>;
//# sourceMappingURL=marketplaceDeliveryService.d.ts.map