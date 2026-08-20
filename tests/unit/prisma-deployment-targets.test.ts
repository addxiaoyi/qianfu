import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schemas = [
  'prisma/schema.prisma',
  'prisma/schema.mysql.prisma',
  'prisma/schema.postgresql.prisma',
];

describe('Prisma deployment binary targets', () => {
  it.each(schemas)('%s includes the AlmaLinux OpenSSL target', (file) => {
    const schema = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(schema).toContain('rhel-openssl-1.1.x');
  });

  it('generates the production SQLite client during the server build', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['server:build']).toContain(
      'prisma generate --schema=prisma/schema.prisma',
    );
  });

  it.each([
    'prisma/schema.mysql.prisma',
    'prisma/schema.postgresql.prisma',
  ])('%s does not overwrite the SQLite local client', (file) => {
    const schema = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(schema).not.toContain('generator localClient');
  });
});
