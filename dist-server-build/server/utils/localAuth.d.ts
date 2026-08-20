import type { Response } from 'express';
import { type JwtPayload } from 'jsonwebtoken';
export declare const LOCAL_AUTH_COOKIE_NAME: string;
export declare const LOCAL_AUTH_ISSUER: string;
export declare const LOCAL_AUTH_AUDIENCE: string;
export declare const LOCAL_AUTH_ALGORITHM: "HS256";
export interface LocalAuthTokenPayload extends JwtPayload {
    userId: number;
    mode: 'local-auth';
    iat: number;
}
export declare function signLocalAuthToken(userId: number): string;
export declare function verifyLocalAuthToken(token: string): LocalAuthTokenPayload;
export declare function setLocalAuthCookie(res: Response, token: string): void;
export declare function clearLocalAuthCookie(res: Response): void;
//# sourceMappingURL=localAuth.d.ts.map