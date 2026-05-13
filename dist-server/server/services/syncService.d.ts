import type { Prisma } from '../db';
/**
 * Syncs local server data to the main Supabase database
 */
export declare const syncServerToMainDB: (localServerId: number) => Promise<{
    link: string | null;
    review_notes: string | null;
    ip: string | null;
    name: string;
    id: number;
    created_at: Date;
    updated_at: Date;
    activity: number;
    owner_id: number;
    reviewed_by: number | null;
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
    synced_at: Date | null;
    review_status: string;
    reviewed_at: Date | null;
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
//# sourceMappingURL=syncService.d.ts.map