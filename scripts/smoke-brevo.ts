import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifySmtp() {
  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
  const user = process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS;
  const secure = (process.env.BREVO_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';

  if (!host || !user || !pass) {
    console.log('[Brevo SMTP] skipped: missing host/user/pass');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.verify();
  console.log('[Brevo SMTP] verify ok');
}

async function verifyApi() {
  const apiKey = process.env.BREVO_API_KEY;
  const apiBaseUrl = process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3';

  if (!apiKey) {
    console.log('[Brevo API] skipped: missing BREVO_API_KEY');
    return;
  }

  const res = await axios.get(`${apiBaseUrl}/account`, {
    headers: {
      'api-key': apiKey,
    },
    timeout: 12000,
  });

  console.log('[Brevo API] account ok:', res.status, res.data?.email || '(email hidden)');
}

async function main() {
  await verifySmtp();
  await verifyApi();
  console.log('Brevo smoke finished');
}

main().catch((err) => {
  console.error('Brevo smoke failed:', err?.message || err);
  process.exit(1);
});
