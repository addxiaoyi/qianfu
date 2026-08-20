export declare const SESSION_REFERENCE_PATTERN: RegExp;
export declare function createSessionReference(userId: string, sessionHandle: string): string;
export declare function resolveSessionHandle(userId: string, sessionReference: string, sessionHandles: readonly string[]): string | null;
//# sourceMappingURL=sessionReference.d.ts.map