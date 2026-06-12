/**
 * Shared constants and types for servers controller
 */
import type { Prisma } from '../../db';
export declare const PUBLIC_SERVERS_CACHE_PREFIX = "server:public_list:";
export declare const PUBLIC_SERVERS_TTL = 60;
export declare const SERVER_SELECTION: {
    readonly id: true;
    readonly name: true;
    readonly name_en: true;
    readonly thumbnail: true;
    readonly summary: true;
    readonly summary_en: true;
    readonly ip: true;
    readonly group_number: true;
    readonly tags: true;
    readonly activity: true;
    readonly updated_at: true;
    readonly created_at: true;
    readonly owner_id: true;
    readonly link: true;
    readonly review_status: true;
    readonly platform: true;
    readonly category: true;
    readonly online_mode: true;
    readonly supported_versions: true;
    readonly network_env: true;
    readonly like_count: true;
    readonly comment_count: true;
};
/** Public list: keep it relation-free to avoid schema drift on status tables. */
export declare const SERVER_LIST_SELECTION: {
    readonly id: true;
    readonly name: true;
    readonly name_en: true;
    readonly thumbnail: true;
    readonly summary: true;
    readonly summary_en: true;
    readonly ip: true;
    readonly group_number: true;
    readonly tags: true;
    readonly activity: true;
    readonly updated_at: true;
    readonly created_at: true;
    readonly owner_id: true;
    readonly link: true;
    readonly review_status: true;
    readonly platform: true;
    readonly category: true;
    readonly online_mode: true;
    readonly supported_versions: true;
    readonly network_env: true;
    readonly like_count: true;
    readonly comment_count: true;
};
export declare const SERVER_ORDER_BY: Prisma.ServerOrderByWithRelationInput[];
//# sourceMappingURL=shared.d.ts.map