import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const results: CheckResult[] = [];
const SKIP_CORE = process.argv.includes('--skip-core');

function pushResult(name: string, status: CheckStatus, detail: string) {
  results.push({ name, status, detail });
}

function icon(status: CheckStatus): string {
  if (status === 'pass') return '✅';
  if (status === 'warn') return '⚠️';
  return '❌';
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function emailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_SMTP_LOGIN ||
      process.env.BREVO_API_KEY ||
      process.env.SMTP_USER ||
      process.env.EMAIL_USER,
  );
}

async function verifySmtp() {
  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
  const user = process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS;
  const secure = (process.env.BREVO_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';

  if (!host || !user || !pass) {
    pushResult('SMTP', 'warn', 'skipped: missing host/user/pass');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.verify();
  pushResult('SMTP', 'pass', `verify ok (${host}:${port})`);
}

async function verifyBrevoApi() {
  const apiKey = process.env.BREVO_API_KEY;
  const apiBaseUrl = process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3';

  if (!apiKey) {
    pushResult('Brevo API', 'warn', 'skipped: missing BREVO_API_KEY');
    return;
  }

  const res = await axios.get(`${apiBaseUrl}/account`, {
    headers: { 'api-key': apiKey },
    timeout: 12000,
  });

  pushResult('Brevo API', 'pass', `ok (${res.status})`);
}

async function verifySuperTokensCore() {
  const connectionURI = required('SUPERTOKENS_CONNECTION_URI', 'http://127.0.0.1:3567');
  const apiKey = process.env.SUPERTOKENS_API_KEY || undefined;

  const url = `${connectionURI.replace(/\/$/, '')}/hello`;
  const res = await axios.get(url, {
    headers: apiKey ? { 'api-key': apiKey } : undefined,
    timeout: 8000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`SuperTokens core unreachable (${res.status})`);
  }

  pushResult('SuperTokens Core', 'pass', `reachable (${connectionURI})`);
}

function printReport() {
  console.log('\n=== Auth + Mail Smoke Report ===');
  for (const r of results) {
    console.log(`${icon(r.status)} [${r.name}] ${r.detail}`);
  }

  const hasFail = results.some((r) => r.status === 'fail');
  const hasWarn = results.some((r) => r.status === 'warn');

  if (hasFail) {
    console.log('Result: FAIL');
  } else if (hasWarn) {
    console.log('Result: PASS_WITH_WARNINGS');
  } else {
    console.log('Result: PASS');
  }
}

async function main() {
  required('DATABASE_URL');
  if (!SKIP_CORE) {
    required('SUPERTOKENS_CONNECTION_URI', 'http://127.0.0.1:3567');
  }

  if (!emailConfigured()) {
    throw new Error('Email channel not configured (Brevo SMTP/API or SMTP/EMAIL).');
  }

  if (SKIP_CORE) {
    pushResult('SuperTokens Core', 'warn', 'skipped by --skip-core');
  } else {
    await verifySuperTokensCore();
  }

  await verifySmtp();
  await verifyBrevoApi();

  printReport();
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  pushResult('Runner', 'fail', msg);
  printReport();
  process.exit(1);
});
