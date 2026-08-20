import type { Prisma } from '../db';
/**
 * Syncs local server data to the main Supabase database
 */
export declare const syncServerToMainDB: (localServerId: number) => Promise<{
    ip: string | null;
    name: string;
    link: string | null;
    id: number;
    created_at: Date;
    updated_at: Date;
    activity: number;
    owner_id: number;
    reviewed_by: number | null;
    listing_price_paid: number | null;
    like_count: number;
    comment_count: number;
    supported_versions: string | null;
    network_env: string | null;
    name_en: string | null;
    thumbnail: string | null;
    summary: string | null;
    summary_en: string | null;
    content_html: string | null;
    group_number: string | null;
    tags: string | null;
    platform: string | null;
    category: string | null;
    online_mode: boolean | null;
    listing_plan: string | null;
    synced_at: Date | null;
    review_status: string;
    review_notes: string | null;
    reviewed_at: Date | null;
    listing_started_at: Date | null;
    listing_expires_at: Date | null;
} | undefined>;
/**
 * Syncs local server status to the main Supabase database
 */
export declare const syncServerStatusToMainDB: (serverId: number) => Promise<void>;
/**
 * Periodically sync all unsynced or updated servers and clean up stale data
 */
export declare const startPeriodicSync: () => void;
export declare const syncUserToCMS: (user: {
    email: string;
    role: string;
}) => Promise<void>;
export declare const syncServerToCMS: (server: Prisma.ServerGetPayload<{}>) => Promise<void>;
export declare const stopPeriodicSync: () => void;
//# sourceMappingURL=syncService.d.ts.map