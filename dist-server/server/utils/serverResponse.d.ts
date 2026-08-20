export declare const normalizeServerTags: (value: unknown) => string[];
export declare const normalizeServerRecord: <T extends Record<string, unknown>>(server: T) => T & {
    tags: string[];
};
export declare const normalizeServerRecords: <T extends Record<string, unknown>>(servers: T[]) => Array<T & {
    tags: string[];
}>;
//# sourceMappingURL=serverResponse.d.ts.map