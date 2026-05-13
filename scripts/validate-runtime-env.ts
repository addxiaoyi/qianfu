import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const runtimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ADMIN_TOKEN: z.string().min(16),
  FRONTEND_URL: z.string().url(),
});

function main() {
  const parsed = runtimeSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('[validate:env] Invalid runtime env:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  const env = parsed.data;
  console.log('[validate:env] Runtime env looks good.');
  console.log(`[validate:env] NODE_ENV=${env.NODE_ENV}`);
  console.log(`[validate:env] PORT=${env.PORT}`);
}

main();
