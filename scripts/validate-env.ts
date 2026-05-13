import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

/**
 * 注意：主应用以 server/config/env.ts 为准；本脚本偏旧版 XPAY 全栈假设。
 * 若仅用 SuperTokens + QianFu，可改用 CONFIG-GUIDE.md 逐项核对，不必强跑本脚本。
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'XPAY_TOKEN',
  'XPAY_API_URL',
  'XPAY_NOTIFY_URL'
];

function validateEnv() {
  console.log('[Env] Validating environment variables...');
  
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('[Env] Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease check your .env file or system environment variables.');
    process.exit(1);
  }

  // Specific format validations
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('://') && !process.env.DATABASE_URL.startsWith('file:')) {
    console.warn('[Env] DATABASE_URL format might be invalid.');
  }

  if (process.env.REDIS_ENABLED === 'true' && !process.env.REDIS_URL) {
    console.error('[Env] REDIS_ENABLED is true but REDIS_URL is missing.');
    process.exit(1);
  }

  // Check if .env exists
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('[Env] .env file not found, using system environment variables.');
  } else {
    // Check for potential security issues in .env
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('password=123456') || envContent.includes('secret=mysecret')) {
      console.warn('[Env] Warning: Potential default passwords/secrets detected in .env file.');
    }
  }

  console.log('[Env] Environment variables validated successfully');
  
  // Log configuration status
  console.log('\n--- Configuration Status ---');
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL?.split('@').pop()?.split('?')[0]}`); // Mask credentials
  console.log(`Redis: ${process.env.REDIS_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`WAF: ${process.env.WAF_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log('---------------------------\n');
}

validateEnv();
