import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
const assignments = template
  .split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => {
    const index = line.indexOf('=');
    return { name: line.slice(0, index), value: line.slice(index + 1).trim() };
  });

const sensitiveName = /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|APP_SECRET|ENCRYPTION_KEY)$/;
const highEntropyLiteral = /^[A-Za-z0-9+/_=-]{24,}$/;

describe('environment template secret hygiene', () => {
  it('contains no fixed high-entropy credential literals', () => {
    const suspicious = assignments.filter(({ name, value }) =>
      sensitiveName.test(name)
      && value.length > 0
      && !value.startsWith('<YOUR_')
      && highEntropyLiteral.test(value));
    expect(suspicious.map(({ name }) => name)).toEqual([]);
  });

  it('uses explicit placeholders for high-risk integration secrets', () => {
    for (const name of [
      'XPAY_TOKEN',
      'XPAY_GATEWAY_NOTIFY_SECRET',
      'XPAY_BRIDGE_NOTIFY_SECRET',
      'PERSONAL_QR_LISTENER_SECRET',
      'PAYPRO_OPENAPI_SECRET',
      'WALLET_SECRET',
      'MAIL_CONFIG_ENCRYPTION_KEY',
      'MAIL_CONFIG_LEGACY_ENCRYPTION_KEY',
    ]) {
      expect(template).toContain(`${name}=<YOUR_${name}_HERE>`);
    }
  });
});
