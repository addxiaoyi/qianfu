// ============================================================================
// Constants
// ============================================================================
export const PUBLIC_SERVERS_CACHE_PREFIX = 'server:public_list:';
export const PUBLIC_SERVERS_TTL = 60; // 1 minute
// ============================================================================
// Shared Selections
// ============================================================================
export const SERVER_SELECTION = {
    id: true,
    name: true,
    name_en: true,
    thumbnail: true,
    summary: true,
    summary_en: true,
    ip: true,
    group_number: true,
    tags: true,
    activity: true,
    updated_at: true,
    created_at: true,
    owner_id: true,
    link: true,
    review_status: true,
    platform: true,
    category: true,
    online_mode: true,
    supported_versions: true,
    network_env: true,
    like_count: true,
    comment_count: true,
};
/** Public list: keep it relation-free to avoid schema drift on status tables. */
export const SERVER_LIST_SELECTION = {
    ...SERVER_SELECTION,
};
export const SERVER_ORDER_BY = [
    { activity: 'desc' },
    { updated_at: 'desc' }
];
//# sourceMappingURL=shared.js.map