import jwt from 'jsonwebtoken';
import { getJwtSecret } from './securityConfig';
export const LOCAL_AUTH_COOKIE_NAME = process.env.LOCAL_AUTH_COOKIE_NAME || 'qf_auth_token';
export const LOCAL_AUTH_ISSUER = process.env.LOCAL_AUTH_ISSUER || 'qianfu-api';
export const LOCAL_AUTH_AUDIENCE = process.env.LOCAL_AUTH_AUDIENCE || 'qianfu-web';
export const LOCAL_AUTH_ALGORITHM = 'HS256';
export function signLocalAuthToken(userId) {
    if (!Number.isInteger(userId) || userId <= 0)
        throw new Error('Invalid local auth user ID');
    return jwt.sign({ userId, mode: 'local-auth' }, getJwtSecret(), {
        algorithm: LOCAL_AUTH_ALGORITHM,
        issuer: LOCAL_AUTH_ISSUER,
        audience: LOCAL_AUTH_AUDIENCE,
        subject: String(userId),
        expiresIn: '7d',
    });
}
export function verifyLocalAuthToken(token) {
    const payload = jwt.verify(token, getJwtSecret(), {
        algorithms: [LOCAL_AUTH_ALGORITHM],
        issuer: LOCAL_AUTH_ISSUER,
        audience: LOCAL_AUTH_AUDIENCE,
    });
    if (payload.mode !== 'local-auth'
        || !Number.isInteger(payload.userId)
        || payload.userId <= 0
        || payload.sub !== String(payload.userId)
        || !Number.isInteger(payload.iat)
        || payload.iat <= 0) {
        throw new Error('Invalid local auth token claims');
    }
    return payload;
}
export function setLocalAuthCookie(res, token) {
    res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
export function clearLocalAuthCookie(res) {
    res.clearCookie(LOCAL_AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined,
    });
}
//# sourceMappingURL=localAuth.js.map