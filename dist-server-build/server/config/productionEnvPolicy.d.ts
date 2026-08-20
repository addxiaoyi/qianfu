export type RuntimeEnvInput = Record<string, string | undefined>;
export type EnvironmentIssue = {
    field: string;
    message: string;
};
export type ProductionEnvironmentResult = {
    ok: boolean;
    errors: EnvironmentIssue[];
    warnings: EnvironmentIssue[];
};
export declare function validateProductionRuntimeEnv(env: RuntimeEnvInput): ProductionEnvironmentResult;
//# sourceMappingURL=productionEnvPolicy.d.ts.map