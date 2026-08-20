const SQLITE_PREFIX = 'file:';
function normalizeUrl(url) {
    return String(url || '').trim();
}
function stripDefaultSqliteConnectionSuffix(url) {
    return url.replace(/\?connection_limit=\d+$/i, '');
}
export function getDatabaseUrl() {
    return normalizeUrl(process.env.DATABASE_URL);
}
export function getLocalDatabaseUrl() {
    return normalizeUrl(process.env.LOCAL_DATABASE_URL) || getDatabaseUrl();
}
export function isSqliteUrl(url) {
    const value = normalizeUrl(url);
    return value.startsWith(SQLITE_PREFIX) || value.endsWith('.db') || value.includes('.db?');
}
export function isPostgresUrl(url) {
    const value = normalizeUrl(url).toLowerCase();
    return value.startsWith('postgresql://') || value.startsWith('postgres://');
}
export function isMySqlUrl(url) {
    const value = normalizeUrl(url).toLowerCase();
    return value.startsWith('mysql://');
}
export function getPrimaryDbProvider() {
    const url = getDatabaseUrl();
    if (isSqliteUrl(url))
        return 'sqlite';
    if (isPostgresUrl(url))
        return 'postgresql';
    if (isMySqlUrl(url))
        return 'mysql';
    return 'unknown';
}
export function getLocalDbProvider() {
    const url = getLocalDatabaseUrl();
    if (isSqliteUrl(url))
        return 'sqlite';
    if (isPostgresUrl(url))
        return 'postgresql';
    if (isMySqlUrl(url))
        return 'mysql';
    return 'unknown';
}
export function isPrimaryAndLocalDatabaseSame() {
    const primary = stripDefaultSqliteConnectionSuffix(getDatabaseUrl());
    const local = stripDefaultSqliteConnectionSuffix(getLocalDatabaseUrl());
    return primary.length > 0 && primary === local;
}
//# sourceMappingURL=dbProvider.js.map