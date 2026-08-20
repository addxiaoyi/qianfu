import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'server/app.ts'), 'utf8');
const guardSource = readFileSync(resolve(process.cwd(), 'server/bootstrap/httpGuards.ts'), 'utf8');

describe('proxy trust policy', () => {
  it('keeps reverse-proxy trust bounded to the configured BaoTa hop', () => {
    expect(appSource).toContain("app.set('trust proxy', 1);");
    expect(guardSource).not.toContain("app.enable('trust proxy')");
    expect(guardSource).not.toContain("process.env.TRUST_PROXY === 'true'");
  });
});
