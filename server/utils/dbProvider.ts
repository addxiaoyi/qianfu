const SQLITE_PREFIX = 'file:';

function normalizeUrl(url: string | undefined | null): string {
  return String(url || '').trim();
}

function stripDefaultSqliteConnectionSuffix(url: string): string {
  return url.replace(/\?connection_limit=\d+$/i, '');
}

export function getDatabaseUrl(): string {
  return normalizeUrl(process.env.DATABASE_URL);
}

export function getLocalDatabaseUrl(): string {
  return normalizeUrl(process.env.LOCAL_DATABASE_URL) || getDatabaseUrl();
}

export function isSqliteUrl(url: string | undefined | null): boolean {
  const value = normalizeUrl(url);
  return value.startsWith(SQLITE_PREFIX) || value.endsWith('.db') || value.includes('.db?');
}

export function isPostgresUrl(url: string | undefined | null): boolean {
  const value = normalizeUrl(url).toLowerCase();
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

export function isMySqlUrl(url: string | undefined | null): boolean {
  const value = normalizeUrl(url).toLowerCase();
  return value.startsWith('mysql://');
}

export function getPrimaryDbProvider(): 'sqlite' | 'postgresql' | 'mysql' | 'unknown' {
  const url = getDatabaseUrl();
  if (isSqliteUrl(url)) return 'sqlite';
  if (isPostgresUrl(url)) return 'postgresql';
  if (isMySqlUrl(url)) return 'mysql';
  return 'unknown';
}

export function getLocalDbProvider(): 'sqlite' | 'postgresql' | 'mysql' | 'unknown' {
  const url = getLocalDatabaseUrl();
  if (isSqliteUrl(url)) return 'sqlite';
  if (isPostgresUrl(url)) return 'postgresql';
  if (isMySqlUrl(url)) return 'mysql';
  return 'unknown';
}

export function isPrimaryAndLocalDatabaseSame(): boolean {
  const primary = stripDefaultSqliteConnectionSuffix(getDatabaseUrl());
  const local = stripDefaultSqliteConnectionSuffix(getLocalDatabaseUrl());
  return primary.length > 0 && primary === local;
}
