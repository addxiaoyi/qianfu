/**
 * Dev Auth Service
 *
 * 杩欐槸涓€涓紑鍙戠幆澧冧笓鐢ㄦ湇鍔★紝鐢ㄤ簬缁曡繃 SuperTokens 璁よ瘉杩涜鏈湴璋冭瘯銆? *
 * 鈿狅笍 閲嶈鏉冮檺杈圭晫璇存槑锛? *
 * 1. Dev 鐧诲綍 NOT 鍒涘缓 SuperTokens 浼氳瘽
 *    - Dev 鐧诲綍浠呰缃竴涓?HTTP-only cookie (DEV_AUTH_COOKIE_NAME)
 *    - 涓嶄細璋冪敤 Session.createSession()
 *    - 涓嶄細鍦?SuperTokens Core 涓垱寤虹敤鎴锋垨浼氳瘽
 *
 * 2. Dev 鐢ㄦ埛鏉冮檺
 *    - 鑷姩鎷ユ湁 ADMIN 瑙掕壊
 *    - 鎷ユ湁鎵€鏈夋潈闄愶紝鐩稿綋浜庤秴绾х鐞嗗憳
 *    - 涓嶄細杩涜浠讳綍鏉冮檺妫€鏌?(authorize, adminOnly, hasPermission)
 *      浼氱洿鎺ラ€氳繃锛屽洜涓?req.isAdmin = true
 *
 * 3. Dev 鐢ㄦ埛鏁版嵁
 *    - 鍦?prisma.users 琛ㄤ腑鑷姩鍒涘缓/鑾峰彇涓€鏉¤褰? *    - role: 'ADMIN'
 *    - 鎵€鏈?permissions 鍧囨嫢鏈? *    - 涓嶄細鍦?SuperTokens Core 涓垱寤虹敤鎴? *
 * 4. 鐜鍙橀噺鎺у埗
 *    - 浠呭綋 NODE_ENV === 'development' 涓?DEV_AUTH_ENABLED=true 鏃剁敓鏁? *    - 鍙€氳繃鐜鍙橀噺 DEV_AUTH_COOKIE_NAME 鑷畾涔?cookie 鍚嶇О
 *    - cookie 鍊兼槸 JWT 绛惧悕锛屽彲閰嶇疆瀵嗛挜 DEV_AUTH_SECRET
 *
 * 5. 瀹夊叏椋庨櫓
 *    - Dev 鐧诲綍 cookie 搴斾粎鐢ㄤ簬鏈湴璋冭瘯
 *    - 鐢熶骇鐜 NEVER 鍚敤 Dev Auth
 *    - 濡傛灉鏆撮湶 Dev cookie 鏈哄埗缁欑敓浜х幆澧冿紝搴旂珛鍗虫挙閿€骞惰疆鎹㈠瘑閽? *
 * 6. 涓庨獙璇佺爜鐧诲綍鐨勫尯鍒? *    - 楠岃瘉鐮佺櫥褰曚細鍒涘缓 SuperTokens 浼氳瘽锛岃蛋姝ｅ父璁よ瘉娴佺▼
 *    - Code login uses a generic registration-safe response for unknown accounts
 *    - Dev 鐧诲綍瀹屽叏缁曡繃杩欎簺鏈哄埗锛岀洿鎺ユ巿浜堢鐞嗗憳鏉冮檺
 */
import { Request } from 'express';
import { User } from '../db';
export declare const DEV_AUTH_COOKIE_NAME: string;
export declare function getDevAuthUsername(): string;
export declare function getDevAuthPassword(): string;
export declare function isDevAuthBypassEnabled(): boolean;
export declare function isDevAuthCookiePresent(req: Request): boolean;
export declare function getOrCreateDevAuthUser(): Promise<User>;
//# sourceMappingURL=devAuth.d.ts.map