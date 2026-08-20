import type { NextFunction, Request, Response } from 'express';
export type AiGuardResult = {
    blocked: false;
} | {
    blocked: true;
    code: string;
};
export declare function normalizeAiInput(value: string): string;
export declare function inspectAiInput(value: string): AiGuardResult;
export declare function containsSensitiveAiOutput(value: string): boolean;
export declare function aiWebOriginGuard(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function auditBlockedAiInput(req: Request, code: string): void;
//# sourceMappingURL=aiAbuseGuard.d.ts.map