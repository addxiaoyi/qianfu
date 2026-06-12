import type { Response } from 'express';
export declare const LOCAL_AUTH_COOKIE_NAME: string;
export declare function signLocalAuthToken(userId: number): string;
export declare function setLocalAuthCookie(res: Response, token: string): void;
export declare function clearLocalAuthCookie(res: Response): void;
//# sourceMappingURL=localAuth.d.ts.map