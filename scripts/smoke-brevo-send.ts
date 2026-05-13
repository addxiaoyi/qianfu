import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  const apiKey = required('BREVO_API_KEY');
  const to = required('BREVO_TEST_TO');
  const from = process.env.BREVO_SMTP_FROM || process.env.BREVO_SMTP_LOGIN;
  const senderEmail = from || required('SMTP_FROM');
  const senderName = process.env.BRAND_NAME || 'QianFu';
  const apiBaseUrl = process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3';

  const ts = new Date().toISOString();

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: to }],
    subject: `[Smoke] Brevo send test ${ts}`,
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Brevo Send Smoke Test</h2>
          <p>This is a test message from QianFu.</p>
          <p><strong>Time:</strong> ${ts}</p>
          <p>If you received this email, Brevo API sending works.</p>
        </body>
      </html>
    `,
  };

  const res = await axios.post(`${apiBaseUrl}/smtp/email`, payload, {
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    timeout: 15000,
  });

  console.log('[Brevo Send] ok:', res.status, res.data?.messageId || '(no messageId)');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[Brevo Send] failed:', msg);
  process.exit(1);
});
