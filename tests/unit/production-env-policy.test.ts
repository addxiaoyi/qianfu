import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import { optionalEnv } from '../../server/config/envParsing';
import { validateProductionRuntimeEnv, type RuntimeEnvInput } from '../../server/config/productionEnvPolicy';

const strong = (seed: string) => `${seed}A9!b7@C5#d3$E1%f8^G6&h4*J2(K0)`.repeat(4);

  const validProductionEnv = (): RuntimeEnvInput => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://qianfu:password@db.internal:5432/qianfu',
  JWT_SECRET: strong('jwt-A_'),
  ADMIN_TOKEN: strong('admin-B_'),
  WALLET_SECRET: strong('wallet-C_'),
  MODERATION_ENCRYPTION_KEY: strong('moderation-C2_'),
  MAIL_CONFIG_ENCRYPTION_KEY: strong('mail-C3_'),
  FRONTEND_URL: 'https://mc-u.top',
  API_PUBLIC_URL: 'https://mc-u.top',
  CORS_ORIGIN: 'https://mc-u.top',
  COOKIE_DOMAIN: 'mc-u.top',
  FORCE_HTTPS: 'true',
    TRUST_PROXY: 'true',
  PERSONAL_FILING_MODE: 'false',
  REDIS_ENABLED: 'true',
  REDIS_URL: 'redis://127.0.0.1:6379',
  UPLOAD_DIR: path.resolve('persistent-data/uploads'),
  VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS: 'mc-u.top,pay.example.net',
  DEFAULT_PAYMENT_UPSTREAM_PROVIDER: 'xpay',
  XPAY_TOKEN: strong('xpay-D_'),
  XPAY_API_URL: 'http://127.0.0.1:8889/starmc/pay',
  XPAY_NOTIFY_URL: 'https://mc-u.top/api/v1/payment/xpay/notify',
  XPAY_GATEWAY_NOTIFY_SECRET: strong('notify-E_'),
  PAYPRO_DEV_MOCK_ENABLED: 'false',
  PAYPRO_DEV_MOCK_MARK_COMPLETED: 'false',
});

describe('production environment policy', () => {
  it('accepts a complete production baseline without exposing secret values', () => {
    const result = validateProductionRuntimeEnv(validProductionEnv());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['WALLET_SECRET', ''],
    ['MODERATION_ENCRYPTION_KEY', ''],
    ['DATABASE_URL', 'file:./production.db'],
    ['REDIS_ENABLED', 'false'],
    ['FRONTEND_URL', 'http://mc-u.top'],
    ['UPLOAD_DIR', './uploads'],
    ['PAYPRO_DEV_MOCK_ENABLED', 'true'],
  ] as const)('rejects unsafe production setting %s', (field, value) => {
    const env = validProductionEnv();
    env[field] = value;
    const result = validateProductionRuntimeEnv(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === field || (field === 'FRONTEND_URL' && issue.field === 'API_PUBLIC_URL'))).toBe(true);
  });

  it('accepts multiple CORS origins when the frontend origin is included', () => {
    const env = validProductionEnv();
    env.CORS_ORIGIN = 'https://mc-u.top,https://www.mc-u.top';
    expect(validateProductionRuntimeEnv(env).ok).toBe(true);
  });

  it('allows database-managed payment projects without environment-level provider credentials', () => {
    const env = validProductionEnv();
    delete env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER;
    delete env.VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS;
    delete env.XPAY_TOKEN;
    delete env.XPAY_API_URL;
    delete env.XPAY_NOTIFY_URL;
    delete env.XPAY_GATEWAY_NOTIFY_SECRET;

    const result = validateProductionRuntimeEnv(env);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((issue) => issue.field === 'DEFAULT_PAYMENT_UPSTREAM_PROVIDER')).toBe(true);
  });

  it('rejects every commercial payment setting in personal filing mode', () => {
    const env = validProductionEnv();
    env.PERSONAL_FILING_MODE = 'true';
    env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER = 'xpay';
    env.DEFAULT_PAYMENT_BACKUP_PROVIDER = 'paypal';
    env.VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS = 'mc-u.top,pay.example.net';
    env.PAYPRO_ENABLED = 'true';

    const result = validateProductionRuntimeEnv(env);

    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.field)).toEqual(expect.arrayContaining([
      'DEFAULT_PAYMENT_UPSTREAM_PROVIDER',
      'DEFAULT_PAYMENT_BACKUP_PROVIDER',
      'VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS',
      'PAYPRO_ENABLED',
    ]));
  });

  it('rejects QianFu commercial runtime enablement in personal filing mode', () => {
    const env = validProductionEnv();
    env.PERSONAL_FILING_MODE = 'true';
    env.QIANFU_ENABLED = 'true';

    const result = validateProductionRuntimeEnv(env);

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'QIANFU_ENABLED',
      message: 'QIANFU_ENABLED must be false in personal filing mode',
    });
  });

  it('accepts a complete PayPal Live provider configuration', () => {
    const env = validProductionEnv();
    env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER = 'paypal';
    env.PAYPAL_CLIENT_ID = 'client_live_abcdefghijklmnopqrstuvwxyz';
    env.PAYPAL_CLIENT_SECRET = strong('paypal-secret_');
    env.PAYPAL_WEBHOOK_ID = '4FX908237T4838649';
    env.PAYPAL_MODE = 'live';
    env.PAYPAL_RETURN_URL = 'https://mc-u.top/api/v1/payment/paypal/return';
    env.PAYPAL_EXCHANGE_RATE_CNY_PER_USD = '7';
    expect(validateProductionRuntimeEnv(env).ok).toBe(true);
  });

  it('does not require an EPay PID for a V免签 gateway', () => {
    const env = validProductionEnv();
    env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER = 'qiupay';
    env.QIUPAY_BASE_URL = 'https://v.0st.top';
    env.QIUPAY_KEY = strong('vmq-key_');
    env.QIUPAY_NOTIFY_URL = 'https://mc-u.top/api/v1/payment/qiupay/notify';
    env.QIUPAY_RETURN_URL = 'https://mc-u.top/payment/success';

    const result = validateProductionRuntimeEnv(env);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('requires complete image host credentials when image host forwarding is enabled', () => {
    const env = validProductionEnv();
    env.IMAGE_HOST_ENABLED = 'true';
    env.IMAGE_HOST_UPLOAD_URL = 'https://img.example/api/upload';

    const result = validateProductionRuntimeEnv(env);

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === 'IMAGE_HOST_TOKEN')).toBe(true);
  });

  it('accepts a public HTTPS image host with a configured token', () => {
    const env = validProductionEnv();
    env.IMAGE_HOST_ENABLED = 'true';
    env.IMAGE_HOST_UPLOAD_URL = 'https://img.example/api/upload';
    env.IMAGE_HOST_TOKEN = strong('image-host-H_');

    const result = validateProductionRuntimeEnv(env);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts a complete production R2 image storage configuration', () => {
    const env = validProductionEnv();
    Object.assign(env, {
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key-id',
      R2_SECRET_ACCESS_KEY: strong('r2-secret-J_'),
      R2_PUBLIC_BASE_URL: 'https://img.mc-u.top',
    });

    const result = validateProductionRuntimeEnv(env);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects enabled R2 storage without a public HTTPS base URL', () => {
    const env = validProductionEnv();
    Object.assign(env, {
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key-id',
      R2_SECRET_ACCESS_KEY: strong('r2-secret-K_'),
    });

    const result = validateProductionRuntimeEnv(env);

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === 'R2_PUBLIC_BASE_URL')).toBe(true);
  });

  it('rejects private network image host endpoints in production', () => {
    const env = validProductionEnv();
    env.IMAGE_HOST_ENABLED = 'true';
    env.IMAGE_HOST_UPLOAD_URL = 'https://192.168.1.20/api/upload';
    env.IMAGE_HOST_TOKEN = strong('image-host-I_');

    const result = validateProductionRuntimeEnv(env);

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === 'IMAGE_HOST_UPLOAD_URL')).toBe(true);
  });

  it('rejects PayPal without the Live client secret', () => {
    const env = validProductionEnv();
    env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER = 'paypal';
    env.PAYPAL_CLIENT_ID = 'client_live_abcdefghijklmnopqrstuvwxyz';
    env.PAYPAL_MODE = 'live';
    env.PAYPAL_RETURN_URL = 'https://mc-u.top/api/v1/payment/paypal/return';
    const result = validateProductionRuntimeEnv(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === 'PAYPAL_CLIENT_SECRET')).toBe(true);
  });

  it('accepts a Creem product map when a single fallback product is not configured', () => {
    const env = validProductionEnv();
    env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER = 'creem';
    env.CREEM_API_BASE_URL = 'https://api.creem.io';
    env.CREEM_API_KEY = strong('creem-F_');
    env.CREEM_WEBHOOK_SECRET = strong('creem-G_');
    env.CREEM_RETURN_URL = 'https://mc-u.top/api/v1/payment/creem/return';
    env.CREEM_PRODUCT_MAP_JSON = JSON.stringify({
      'custom:1000:CNY': {
        productId: 'prod_usd_2',
        checkoutAmount: 200,
        checkoutCurrency: 'USD',
        walletCreditAmount: 1000,
        walletCreditCurrency: 'CNY',
      },
    });

    const result = validateProductionRuntimeEnv(env);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('normalizes blank optional environment values before constrained parsing', () => {
    const optionalUrl = optionalEnv(z.string().url());
    const optionalSecret = optionalEnv(z.string().min(20));

    expect(optionalUrl.parse('')).toBeUndefined();
    expect(optionalUrl.parse('   ')).toBeUndefined();
    expect(optionalSecret.parse('')).toBeUndefined();
    expect(optionalUrl.parse('https://mc-u.top')).toBe('https://mc-u.top');
  });

  it('rejects weak optional mail encryption keys when configured', () => {
    const env = validProductionEnv();
    env.MAIL_CONFIG_ENCRYPTION_KEY = 'short';
    const result = validateProductionRuntimeEnv(env);
    expect(result.errors.some((issue) => issue.field === 'MAIL_CONFIG_ENCRYPTION_KEY')).toBe(true);
  });

  it('requires complete OAuth configuration and an HTTPS same-origin callback', () => {
    const env = validProductionEnv();
    env.GITHUB_CLIENT_ID = 'client';
    const partial = validateProductionRuntimeEnv(env);
    expect(partial.errors.some((issue) => issue.message.includes('must be configured together'))).toBe(true);

    env.GITHUB_CLIENT_SECRET = strong('github-F_');
    env.GITHUB_CALLBACK_URL = 'http://other.example/api/v1/auth/github/callback';
    const invalidCallback = validateProductionRuntimeEnv(env);
    expect(invalidCallback.errors.some((issue) => issue.message.includes('must use HTTPS in production'))).toBe(true);
  });
});
