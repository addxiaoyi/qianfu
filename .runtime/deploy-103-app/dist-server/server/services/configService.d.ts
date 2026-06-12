/**
 * Retrieve system configuration
 */
export declare function getConfig(key: string, decryptValue?: boolean): Promise<string | null>;
/**
 * Update system configuration
 */
export declare function setConfig(key: string, value: string, isSecret?: boolean, description?: string): Promise<void>;
/**
 * Retrieve all moderation-related configurations
 */
export declare function getModerationConfigs(): Promise<{
    key: string;
    value: string;
    description: string | null;
    updatedAt: Date;
}[]>;
//# sourceMappingURL=configService.d.ts.map