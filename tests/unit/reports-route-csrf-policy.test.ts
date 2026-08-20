import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'server/routes/reports.ts'), 'utf8');

describe('report route CSRF policy', () => {
  it('protects report creation', () => {
    expect(routes).toContain("router.post(\n  '/',\n  requireVerifiedEmail,\n  writeCsrf,");
  });

  it.each([
    "router.patch('/batch-status', writeCsrf, batchUpdateReportStatus);",
    "router.patch('/:id/status', writeCsrf, updateReportStatus);",
  ])('protects state-changing route %s', (declaration) => {
    expect(routes).toContain(declaration);
  });
});
