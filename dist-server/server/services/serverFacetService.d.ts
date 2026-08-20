export declare const SERVER_FACET_KIND: {
    readonly TAG: "TAG";
    readonly VERSION: "VERSION";
    readonly NETWORK_ENV: "NETWORK_ENV";
};
export type ServerFacetKind = typeof SERVER_FACET_KIND[keyof typeof SERVER_FACET_KIND];
export type ServerFacetInput = {
    tags?: unknown;
    supportedVersions?: unknown;
    networkEnv?: unknown;
};
export type ServerFacetRecord = {
    server_id: number;
    kind: ServerFacetKind;
    value: string;
    normalized_value: string;
};
type ServerFacetClient = {
    serverFacet: {
        deleteMany(args: {
            where: {
                server_id: number;
            };
        }): Promise<unknown>;
        createMany(args: {
            data: ServerFacetRecord[];
        }): Promise<unknown>;
    };
};
export declare function normalizeFacetValue(value: string): string;
export declare function parseFacetValues(value: unknown): string[];
export declare function buildServerFacets(serverId: number, input: ServerFacetInput): ServerFacetRecord[];
export declare function replaceServerFacets(client: ServerFacetClient, serverId: number, input: ServerFacetInput): Promise<void>;
export {};
//# sourceMappingURL=serverFacetService.d.ts.map