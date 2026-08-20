import dotenv from 'dotenv';
import { z } from 'zod';

import { optionalEnv } from '../server/config/envParsing';
import { validateProductionRuntimeEnv } from '../server/config/productionEnvPolicy';

dotenv.config();

const runtimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('3000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ADMIN_TOKEN: z.string().min(16),
  WALLET_SECRET: optionalEnv(z.string()),
  MODERATION_ENCRYPTION_KEY: optionalEnv(z.string().min(32)),
  MAIL_CONFIG_ENCRYPTION_KEY: optionalEnv(z.string().min(32)),
  MAIL_CONFIG_LEGACY_ENCRYPTION_KEY: optionalEnv(z.string().min(32)),
  FRONTEND_URL: z.string().url(),
  API_PUBLIC_URL: optionalEnv(z.string().url()),
  FORCE_HTTPS: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  REDIS_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_URL: optionalEnv(z.string()),
  UPLOAD_DIR: optionalEnv(z.string()),
  GITHUB_CLIENT_ID: optionalEnv(z.string().min(1)),
  GITHUB_CLIENT_SECRET: optionalEnv(z.string().min(20)),
  GITHUB_CALLBACK_URL: optionalEnv(z.string().url()),
}).superRefine((env, ctx) => {
  const githubValues = [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, env.GITHUB_CALLBACK_URL];
  const githubPartiallyConfigured = githubValues.some(Boolean) && !githubValues.every(Boolean);
  if (githubPartiallyConfigured) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GITHUB_CLIENT_ID'],
      message: 'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_CALLBACK_URL must be configured together',
    });
  }

  if (env.NODE_ENV === 'production' && env.GITHUB_CALLBACK_URL) {
    const callback = new URL(env.GITHUB_CALLBACK_URL);
    if (callback.protocol !== 'https:') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GITHUB_CALLBACK_URL'],
        message: 'GITHUB_CALLBACK_URL must use HTTPS in production',
      });
    }
    if (env.API_PUBLIC_URL && callback.origin !== new URL(env.API_PUBLIC_URL).origin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GITHUB_CALLBACK_URL'],
        message: 'GITHUB_CALLBACK_URL must use the same origin as API_PUBLIC_URL',
      });
    }
  }
});

function main() {
  const parsed = runtimeSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[validate:env] Invalid runtime env:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  const productionPolicy = validateProductionRuntimeEnv(process.env);
  if (!productionPolicy.ok) {
    console.error('[validate:env] Production environment policy failed:');
    for (const issue of productionPolicy.errors) {
      console.error(`- ${issue.field}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log('[validate:env] Runtime environment passed.');
  console.log(`[validate:env] NODE_ENV=${parsed.data.NODE_ENV}`);
  console.log(`[validate:env] PORT=${parsed.data.PORT}`);
  console.log(`[validate:env] Redis=${parsed.data.REDIS_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
  for (const warning of productionPolicy.warnings) {
    console.warn(`[validate:env] Warning ${warning.field}: ${warning.message}`);
  }
}

main();
