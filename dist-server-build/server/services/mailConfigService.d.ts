export interface MailAdminConfig {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpAllowInvalidCert: boolean;
    smtpUser: string;
    smtpPass: string;
    fromName: string;
    emailFrom: string;
    replyTo: string;
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    imapAllowInvalidCert: boolean;
    imapUser: string;
    imapPass: string;
    contactEmail: string;
    contactPhone: string;
    emailBaseUrl: string;
}
export type MailTransportConfig = {
    kind: 'smtp';
    source: 'system' | 'env-feishu-smtp' | 'env-brevo-smtp' | 'env-smtp';
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
    tlsRejectUnauthorized?: boolean;
} | {
    kind: 'brevo-api';
    source: 'env-brevo-api';
    apiKey: string;
    apiBaseUrl: string;
    from: string;
} | {
    kind: 'service';
    source: 'env-service';
    service: string;
    user: string;
    pass: string;
    from: string;
} | {
    kind: 'none';
    source: 'disabled' | 'none';
    from?: string;
};
export interface EffectiveMailRuntime {
    source: MailTransportConfig['source'];
    configured: boolean;
    enabled: boolean;
    transport: MailTransportConfig;
    meta: {
        contactEmail: string;
        contactPhone: string;
        emailBaseUrl: string;
    };
    adminConfig: MailAdminConfig;
    diagnostics: {
        usingSystemConfig: boolean;
        usingEnvFallback: boolean;
        hasSecret: boolean;
    };
}
export declare function getMailConfigForAdmin(): Promise<{
    config: MailAdminConfig;
    maskedSecrets: Partial<Record<keyof MailAdminConfig, string>>;
    effective: EffectiveMailRuntime;
}>;
export declare function saveMailConfig(input: Partial<MailAdminConfig>): Promise<MailAdminConfig>;
export declare function getEffectiveMailRuntime(): Promise<EffectiveMailRuntime>;
//# sourceMappingURL=mailConfigService.d.ts.map