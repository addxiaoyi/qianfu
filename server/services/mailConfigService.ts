import crypto from 'crypto';
import prisma from '../db';
import { logger } from '../utils/logger';

const MAIL_CONFIG_PREFIX = 'mail_config:';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const MIN_ENCRYPTION_KEY_LENGTH = 32;

export interface MailAdminConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpAllowInvalidCert: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  contactEmail: string;
  contactPhone: string;
  emailBaseUrl: string;
}

type MailFieldSpec = {
  field: keyof MailAdminConfig;
  key: string;
  type: 'string' | 'number' | 'boolean';
  secret?: boolean;
  description: string;
};

export type MailTransportConfig =
  | {
      kind: 'smtp';
      source: 'system' | 'env-feishu-smtp' | 'env-brevo-smtp' | 'env-smtp';
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from: string;
      tlsRejectUnauthorized?: boolean;
    }
  | {
      kind: 'brevo-api';
      source: 'env-brevo-api';
      apiKey: string;
      apiBaseUrl: string;
      from: string;
    }
  | {
      kind: 'service';
      source: 'env-service';
      service: string;
      user: string;
      pass: string;
      from: string;
    }
  | {
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

const MAIL_FIELD_SPECS: MailFieldSpec[] = [
  { field: 'enabled', key: `${MAIL_CONFIG_PREFIX}enabled`, type: 'boolean', description: 'Enable dynamic mail runtime config' },
  { field: 'smtpHost', key: `${MAIL_CONFIG_PREFIX}smtp_host`, type: 'string', description: 'SMTP host' },
  { field: 'smtpPort', key: `${MAIL_CONFIG_PREFIX}smtp_port`, type: 'number', description: 'SMTP port' },
  { field: 'smtpSecure', key: `${MAIL_CONFIG_PREFIX}smtp_secure`, type: 'boolean', description: 'SMTP secure flag' },
  { field: 'smtpAllowInvalidCert', key: `${MAIL_CONFIG_PREFIX}smtp_allow_invalid_cert`, type: 'boolean', description: 'Allow invalid SMTP TLS certificates' },
  { field: 'smtpUser', key: `${MAIL_CONFIG_PREFIX}smtp_user`, type: 'string', description: 'SMTP username' },
  { field: 'smtpPass', key: `${MAIL_CONFIG_PREFIX}smtp_pass`, type: 'string', secret: true, description: 'SMTP password' },
  { field: 'emailFrom', key: `${MAIL_CONFIG_PREFIX}email_from`, type: 'string', description: 'Default from address' },
  { field: 'contactEmail', key: `${MAIL_CONFIG_PREFIX}contact_email`, type: 'string', description: 'Support contact email' },
  { field: 'contactPhone', key: `${MAIL_CONFIG_PREFIX}contact_phone`, type: 'string', description: 'Support contact phone' },
  { field: 'emailBaseUrl', key: `${MAIL_CONFIG_PREFIX}email_base_url`, type: 'string', description: 'Base URL used in email links' },
];

const DEFAULT_MAIL_ADMIN_CONFIG: MailAdminConfig = {
  enabled: false,
  smtpHost: '',
  smtpPort: 25,
  smtpSecure: false,
  smtpAllowInvalidCert: false,
  smtpUser: '',
  smtpPass: '',
  emailFrom: '',
  contactEmail: '',
  contactPhone: '',
  emailBaseUrl: '',
};

const SECRET_FIELDS = new Set<keyof MailAdminConfig>(
  MAIL_FIELD_SPECS.filter((item) => item.secret).map((item) => item.field),
);

function toKeyBuffer(raw: string): Buffer {
  return crypto.createHash('sha256').update(raw).digest();
}

function getCurrentEncryptionKeyRaw(): string | null {
  const raw =
    process.env.MAIL_CONFIG_ENCRYPTION_KEY ||
    process.env.MODERATION_ENCRYPTION_KEY ||
    '';
  const normalized = raw.trim();
  if (!normalized) return null;
  return normalized;
}

function getLegacyEncryptionKeyRaw(): string | null {
  const raw = process.env.MAIL_CONFIG_LEGACY_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return raw;
}

function getEncryptionKeyBuffer(): Buffer | null {
  const keyRaw = getCurrentEncryptionKeyRaw();
  if (!keyRaw) return null;
  return toKeyBuffer(keyRaw);
}

function assertCurrentEncryptionKeyReady() {
  const keyRaw = getCurrentEncryptionKeyRaw();
  if (!keyRaw) {
    throw new Error(
      'mail config encryption key unavailable: set MAIL_CONFIG_ENCRYPTION_KEY or MODERATION_ENCRYPTION_KEY',
    );
  }
  if (keyRaw.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw new Error(
      `mail config encryption key too short: minimum ${MIN_ENCRYPTION_KEY_LENGTH} characters required`,
    );
  }
}

function encrypt(text: string): string {
  assertCurrentEncryptionKeyReady();
  const key = getEncryptionKeyBuffer();
  if (!key) {
    throw new Error('mail config encryption key unavailable');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptWithKey(text: string, key: Buffer): string {
  const [ivHex, encryptedHex] = text.split(':');
  if (!ivHex || !encryptedHex) return '';
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decrypt(text: string): string {
  const primary = getEncryptionKeyBuffer();
  if (primary) {
    try {
      return decryptWithKey(text, primary);
    } catch {
      // fallback to legacy key for backward compatibility with old ciphertext
    }
  }

  const legacyRaw = getLegacyEncryptionKeyRaw();
  if (legacyRaw) {
    try {
      return decryptWithKey(text, toKeyBuffer(legacyRaw));
    } catch {
      // fall through to explicit failure
    }
  }

  throw new Error('mail config decryption failed with available keys');
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function isLoopbackHost(host: string): boolean {
  const normalized = normalizeString(host).toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

function parseBoolean(value: string): boolean {
  return value === 'true';
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function buildEnvFallbackAdminConfig(): MailAdminConfig {
  const smtpHost =
    normalizeString(process.env.FEISHU_SMTP_HOST) ||
    normalizeString(process.env.BREVO_SMTP_HOST) ||
    normalizeString(process.env.SMTP_HOST);
  const smtpPortRaw =
    normalizeString(process.env.FEISHU_SMTP_PORT) ||
    normalizeString(process.env.BREVO_SMTP_PORT) ||
    normalizeString(process.env.SMTP_PORT);
  const smtpSecureRaw =
    normalizeString(process.env.FEISHU_SMTP_SECURE) ||
    normalizeString(process.env.BREVO_SMTP_SECURE) ||
    normalizeString(process.env.SMTP_SECURE);
  const smtpUser =
    normalizeString(process.env.FEISHU_SMTP_LOGIN) ||
    normalizeString(process.env.BREVO_SMTP_LOGIN) ||
    normalizeString(process.env.SMTP_USER) ||
    normalizeString(process.env.EMAIL_USER);
  const smtpPass =
    normalizeString(process.env.FEISHU_SMTP_KEY) ||
    normalizeString(process.env.BREVO_SMTP_KEY) ||
    normalizeString(process.env.SMTP_PASS) ||
    normalizeString(process.env.EMAIL_PASS);
  const emailFrom =
    normalizeString(process.env.FEISHU_SMTP_FROM) ||
    normalizeString(process.env.BREVO_SMTP_FROM) ||
    normalizeString(process.env.SMTP_FROM) ||
    normalizeString(process.env.EMAIL_FROM) ||
    smtpUser;

  return {
    enabled: Boolean(smtpHost || process.env.BREVO_API_KEY || process.env.EMAIL_SERVICE),
    smtpHost,
    smtpPort: parseNumber(smtpPortRaw, smtpSecureRaw === 'true' ? 465 : 25),
    smtpSecure: smtpSecureRaw === 'true',
    smtpAllowInvalidCert: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false',
    smtpUser,
    smtpPass,
    emailFrom,
    contactEmail: normalizeString(process.env.CONTACT_EMAIL) || emailFrom,
    contactPhone: normalizeString(process.env.CONTACT_PHONE),
    emailBaseUrl: normalizeString(process.env.EMAIL_BASE_URL),
  };
}

async function getStoredMailConfig(): Promise<{ config: MailAdminConfig; hasRows: boolean }> {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        startsWith: MAIL_CONFIG_PREFIX,
      },
    },
  });

  const config: MailAdminConfig = { ...DEFAULT_MAIL_ADMIN_CONFIG };
  for (const spec of MAIL_FIELD_SPECS) {
    const row = rows.find((item) => item.key === spec.key);
    if (!row) continue;
    let raw = row.value;
    if (row.is_secret) {
      try {
        raw = decrypt(row.value);
      } catch (error) {
        logger.warn('[MailConfig] Failed to decrypt secret field, clearing value for safety', {
          key: row.key,
          error: error instanceof Error ? error.message : 'unknown',
        });
        raw = '';
      }
    }
    if (spec.type === 'boolean') {
      config[spec.field] = parseBoolean(raw) as never;
    } else if (spec.type === 'number') {
      config[spec.field] = parseNumber(raw, DEFAULT_MAIL_ADMIN_CONFIG[spec.field] as number) as never;
    } else {
      config[spec.field] = normalizeString(raw) as never;
    }
  }

  return {
    config,
    hasRows: rows.length > 0,
  };
}

export async function getMailConfigForAdmin(): Promise<{
  config: MailAdminConfig;
  maskedSecrets: Partial<Record<keyof MailAdminConfig, string>>;
  effective: EffectiveMailRuntime;
}> {
  const runtime = await getEffectiveMailRuntime();
  const maskedSecrets: Partial<Record<keyof MailAdminConfig, string>> = {};
  const config: MailAdminConfig = {
    ...runtime.adminConfig,
    smtpPass: '',
  };

  for (const field of SECRET_FIELDS) {
    if (runtime.adminConfig[field]) {
      maskedSecrets[field] = maskSecret(String(runtime.adminConfig[field] || ''));
    }
  }

  const effective: EffectiveMailRuntime = {
    ...runtime,
    adminConfig: {
      ...runtime.adminConfig,
      smtpPass: '',
    },
    transport:
      runtime.transport.kind === 'smtp'
        ? {
            ...runtime.transport,
            pass: runtime.transport.pass ? '***MASKED***' : undefined,
          }
        : runtime.transport.kind === 'service'
          ? {
              ...runtime.transport,
              pass: runtime.transport.pass ? '***MASKED***' : '',
            }
          : runtime.transport.kind === 'brevo-api'
            ? {
                ...runtime.transport,
                apiKey: runtime.transport.apiKey ? '***MASKED***' : '',
              }
            : runtime.transport,
  };

  return {
    config,
    maskedSecrets,
    effective,
  };
}

export async function saveMailConfig(input: Partial<MailAdminConfig>): Promise<MailAdminConfig> {
  const current = await getStoredMailConfig();
  const merged: MailAdminConfig = {
    ...current.config,
    ...Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ]),
    ),
  };

  for (const spec of MAIL_FIELD_SPECS) {
    const value = merged[spec.field];
    const shouldDelete =
      spec.type === 'string'
        ? !normalizeString(value)
        : value === undefined || value === null;

    if (shouldDelete) {
      await prisma.systemConfig.deleteMany({ where: { key: spec.key } });
      if (spec.type === 'string') {
        merged[spec.field] = '' as never;
      }
      continue;
    }

    const serialized =
      spec.type === 'boolean'
        ? String(Boolean(value))
        : spec.type === 'number'
          ? String(parseNumber(String(value), DEFAULT_MAIL_ADMIN_CONFIG[spec.field] as number))
          : normalizeString(value);

    await prisma.systemConfig.upsert({
      where: { key: spec.key },
      update: {
        value: spec.secret ? encrypt(serialized) : serialized,
        is_secret: Boolean(spec.secret),
        description: spec.description,
      },
      create: {
        key: spec.key,
        value: spec.secret ? encrypt(serialized) : serialized,
        is_secret: Boolean(spec.secret),
        description: spec.description,
      },
    });
  }

  const stored = await getStoredMailConfig();
  return stored.config;
}

export async function getEffectiveMailRuntime(): Promise<EffectiveMailRuntime> {
  const envFallback = buildEnvFallbackAdminConfig();
  const stored = await getStoredMailConfig();
  const hasStoredConfig = stored.hasRows;
  const adminConfig = hasStoredConfig
    ? {
        ...envFallback,
        ...stored.config,
      }
    : envFallback;

  const systemEnabled = hasStoredConfig ? Boolean(adminConfig.enabled) : true;
  const contactEmail = normalizeString(adminConfig.contactEmail) || envFallback.contactEmail || normalizeString(process.env.EMAIL_FROM);
  const contactPhone = normalizeString(adminConfig.contactPhone) || envFallback.contactPhone;
  const emailBaseUrl =
    normalizeString(adminConfig.emailBaseUrl) ||
    envFallback.emailBaseUrl ||
    normalizeString(process.env.FRONTEND_URL) ||
    '';

  let transport: MailTransportConfig = { kind: 'none', source: hasStoredConfig && !systemEnabled ? 'disabled' : 'none' };

  if (!hasStoredConfig || systemEnabled) {
    const smtpHost = normalizeString(adminConfig.smtpHost);
    const emailFrom = normalizeString(adminConfig.emailFrom) || normalizeString(adminConfig.smtpUser) || envFallback.emailFrom;

    if (smtpHost && emailFrom) {
      transport = {
        kind: 'smtp',
        source: hasStoredConfig ? 'system' : envFallback.smtpHost === normalizeString(process.env.FEISHU_SMTP_HOST)
          ? 'env-feishu-smtp'
          : envFallback.smtpHost === normalizeString(process.env.BREVO_SMTP_HOST)
            ? 'env-brevo-smtp'
            : 'env-smtp',
        host: smtpHost,
        port: adminConfig.smtpPort || envFallback.smtpPort || 25,
        secure: Boolean(adminConfig.smtpSecure),
        user: normalizeString(adminConfig.smtpUser) || undefined,
        pass: normalizeString(adminConfig.smtpPass) || undefined,
        from: emailFrom,
        tlsRejectUnauthorized:
          process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' || isLoopbackHost(smtpHost) || Boolean(adminConfig.smtpAllowInvalidCert)
            ? false
            : undefined,
      };
    } else if (!hasStoredConfig && normalizeString(process.env.BREVO_API_KEY)) {
      const from =
        normalizeString(process.env.BREVO_SMTP_FROM) ||
        normalizeString(process.env.EMAIL_FROM) ||
        normalizeString(process.env.BREVO_SMTP_LOGIN);
      if (from) {
        transport = {
          kind: 'brevo-api',
          source: 'env-brevo-api',
          apiKey: normalizeString(process.env.BREVO_API_KEY),
          apiBaseUrl: normalizeString(process.env.BREVO_API_BASE_URL) || 'https://api.brevo.com/v3',
          from,
        };
      }
    } else if (!hasStoredConfig && normalizeString(process.env.EMAIL_SERVICE) && normalizeString(process.env.EMAIL_USER)) {
      transport = {
        kind: 'service',
        source: 'env-service',
        service: normalizeString(process.env.EMAIL_SERVICE),
        user: normalizeString(process.env.EMAIL_USER),
        pass: normalizeString(process.env.EMAIL_PASS),
        from: normalizeString(process.env.EMAIL_FROM) || normalizeString(process.env.EMAIL_USER),
      };
    }
  }

  return {
    source: transport.source,
    configured: transport.kind !== 'none',
    enabled: transport.kind !== 'none' && (hasStoredConfig ? systemEnabled : true),
    transport,
    meta: {
      contactEmail,
      contactPhone,
      emailBaseUrl,
    },
    adminConfig,
    diagnostics: {
      usingSystemConfig: hasStoredConfig,
      usingEnvFallback: !hasStoredConfig,
      hasSecret: Boolean(normalizeString(adminConfig.smtpPass)),
    },
  };
}
