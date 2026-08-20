export declare function getDatabaseUrl(): string;
export declare function getLocalDatabaseUrl(): string;
export declare function isSqliteUrl(url: string | undefined | null): boolean;
export declare function isPostgresUrl(url: string | undefined | null): boolean;
export declare function isMySqlUrl(url: string | undefined | null): boolean;
export declare function getPrimaryDbProvider(): 'sqlite' | 'postgresql' | 'mysql' | 'unknown';
export declare function getLocalDbProvider(): 'sqlite' | 'postgresql' | 'mysql' | 'unknown';
export declare function isPrimaryAndLocalDatabaseSame(): boolean;
//# sourceMappingURL=dbProvider.d.ts.map