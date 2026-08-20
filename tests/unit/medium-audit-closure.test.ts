import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SERVER_FACET_KIND,
  buildServerFacets,
  parseFacetValues,
} from '../../server/services/serverFacetService';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('medium audit closure', () => {
  it('normalizes multi-value server facets without duplicate exact keys', () => {
    expect(parseFacetValues('["PVP", "基岩"]')).toEqual(['PVP', '基岩']);
    expect(parseFacetValues('大陆, 海外；低延迟')).toEqual(['大陆', '海外', '低延迟']);

    const facets = buildServerFacets(9, {
      tags: ['PVP', 'pvp', '基岩'],
      supportedVersions: '["1.20.4", "1.21"]',
      networkEnv: '大陆, 海外',
    });

    expect(facets).toHaveLength(6);
    expect(facets).toContainEqual({
      server_id: 9,
      kind: SERVER_FACET_KIND.TAG,
      value: 'PVP',
      normalized_value: 'pvp',
    });
    expect(facets).toContainEqual({
      server_id: 9,
      kind: SERVER_FACET_KIND.VERSION,
      value: '1.20.4',
      normalized_value: '1.20.4',
    });
    expect(new Set(facets.map(item => `${item.kind}:${item.normalized_value}`)).size)
      .toBe(facets.length);
  });

  it('owns check-in history and server facets through Prisma and provider migrations', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toContain('model CheckinHistory');
    expect(schema).toContain('@@map("checkin_history")');
    expect(schema).toContain('model ServerFacet');
    expect(schema).toContain('@@map("server_facets")');
    expect(schema).toContain('@@unique([server_id, kind, normalized_value])');

    const migrationDir = 'prisma/migrations/20260731050000_checkin_and_server_facets';
    for (const file of ['migration.sql', 'migration.mysql.sql', 'migration.postgresql.sql']) {
      const relativePath = `${migrationDir}/${file}`;
      expect(existsSync(path.join(root, relativePath))).toBe(true);
      const migration = read(relativePath);
      expect(migration).toContain('checkin_history');
      expect(migration).toContain('server_facets');
      expect(migration).toContain('normalized_value');
    }

    const reconciliationDir = 'prisma/migrations/20260731080000_checkin_history_fk_reconciliation';
    for (const file of ['migration.sql', 'migration.mysql.sql', 'migration.postgresql.sql']) {
      const relativePath = `${reconciliationDir}/${file}`;
      expect(existsSync(path.join(root, relativePath))).toBe(true);
      const migration = read(relativePath);
      expect(migration).toContain('checkin_history');
      expect(migration).toContain('ON DELETE CASCADE');
      expect(migration).toMatch(/User|`User`/);
    }
  });

  it('uses Prisma check-ins, indexed exact filters, atomic facet writes, and one payment completion path', () => {
    const checkin = read('server/controllers/userLevelController.ts');
    expect(checkin).toContain('prisma.checkinHistory');
    expect(checkin).toContain('tx.checkinHistory');
    expect(checkin).not.toContain('ensureCheckinHistoryTable');
    expect(checkin).not.toContain('checkin_history');
    expect(checkin).not.toContain('$executeRawUnsafe');
    expect(checkin).not.toContain('$queryRaw');

    const list = read('server/controllers/servers/list.ts');
    expect(list).toContain('SERVER_FACET_KIND');
    expect(list).toContain('normalizeFacetValue');
    expect(list).toContain('where.facets');
    expect(list).toContain('kind: SERVER_FACET_KIND.VERSION');
    expect(list).not.toContain('where.tags = { contains: tag }');

    for (const file of [
      'server/controllers/servers/crud.ts',
      'server/controllers/servers/versions.ts',
      'server/services/syncService.ts',
    ]) {
      expect(read(file)).toContain('replaceServerFacets');
    }

    const payment = read('server/controllers/paymentController.ts');
    const manualStart = payment.indexOf('export const manualCompletePayment');
    const manualEnd = payment.indexOf('export const getPaypalRefundReviews', manualStart);
    expect(manualStart).toBeGreaterThanOrEqual(0);
    expect(manualEnd).toBeGreaterThan(manualStart);
    const manualSection = payment.slice(manualStart, manualEnd);
    expect(manualSection.match(/completePaymentWithSideEffects\(/g)).toHaveLength(1);
    expect(manualSection).not.toContain('redisService.withLock');
    expect(manualSection).not.toContain('tx.wallet.update');
  });

  it('keeps M-08 through M-10 and M-14 through M-18 infrastructure controls active', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toContain('FROM node:20.19.0-alpine3.21');
    expect(dockerfile).toContain('HEALTHCHECK');

    const build = read('package.json');
    const compression = read('scripts/generate-frontend-compression.mjs');
    const compressionGuard = read('scripts/verify-frontend-compression.mjs');
    expect(build).toContain('node scripts/generate-frontend-compression.mjs qianfu-liandeng/dist --quiet');
    expect(build).toContain('npm run guard:frontend-compression');
    expect(compression).toContain('brotliCompress');
    expect(compression).toContain('gzip');
    expect(compressionGuard).toContain('brotliDecompress');
    expect(compressionGuard).toContain('gunzip');

    const errorMiddleware = read('server/middleware/error.ts');
    expect(errorMiddleware).toContain('err instanceof Error');
    expect(errorMiddleware).toContain('isErrorRecord(err)');
    expect(errorMiddleware).not.toContain('err as {');

    const routes = read('server/routes/index.ts');
    expect(routes).toContain('/api/v1');

    expect(read('server/routes/events.ts')).toContain('adminLimiter');
    expect(read('server/routes/assets.ts')).toContain('staticDataLimiter');
    expect(read('server/routes/stats.ts')).toContain('serversLimiter');

    const security = read('server/bootstrap/security.ts');
    expect(security).toContain('CORS_ALLOWED_ORIGINS');
    expect(security).toContain('getAllowedOrigins');

    const logger = read('server/utils/logger.ts');
    expect(logger).toContain('security(message: string');
  });
});
