import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRoute(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'server/routes', file), 'utf8');
}

describe('administrator route authorization contracts', () => {
  it('protects application and Prometheus metrics with system_config', () => {
    const source = readRoute('metrics.ts');

    expect(source).toContain("const protectMetrics = [adminLimiter, authenticate, hasPermission(['system_config'])]");
    expect(source).toContain("router.get('/metrics', ...protectMetrics");
    expect(source).toContain("router.get('/prometheus', ...protectMetrics");
    expect(source).not.toContain('router.use(');
  });

  it('protects visit analytics with system_config', () => {
    const source = readRoute('visit.ts');

    expect(source).toContain("hasPermission(['system_config'])");
    expect(source).toContain("router.get('/visit/stats', ...protectVisitStats");
    expect(source).toContain("router.get('/visit/popular-pages', ...protectVisitStats");
  });
});
