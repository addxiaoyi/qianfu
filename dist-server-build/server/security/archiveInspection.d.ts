export declare const ARCHIVE_LIMITS: Readonly<{
    maxEntries: 4096;
    maxPathDepth: 32;
    maxNestingDepth: 3;
    maxEntryUncompressedBytes: number;
    maxArchiveUncompressedBytes: number;
    maxTotalExpandedBytes: number;
    maxNestedArchiveBytes: number;
    maxCompressionRatio: 250;
    maxFileNameBytes: 1024;
}>;
export interface ArchiveInspectionSummary {
    entryCount: number;
    totalExpandedBytes: number;
    nestedArchiveCount: number;
    maxDepth: number;
}
export declare function inspectArchiveBuffer(buffer: Buffer): Promise<ArchiveInspectionSummary>;
//# sourceMappingURL=archiveInspection.d.ts.map