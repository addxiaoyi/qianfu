import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = path.resolve('scripts/diagnose-memory.mjs');

describe('memory diagnosis script', () => {
  it('emits a read-only JSON report for cache, upload, lifecycle, and PM2 evidence', () => {
    const raw = execFileSync(process.execPath, [script, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const report = JSON.parse(raw) as {
      caches: Array<{ file: string; evidence: string[] }>;
      uploads: { memoryStorage: string[]; diskStorage: string[] };
      lifecycle: { sse: string[]; polling: string[]; timers: string[] };
      pm2: { configs: string[]; sampling: { localPm2: boolean; heapProfiles: string[]; evidence: string[] } };
    };

    expect(report.caches.some(item => item.file === 'server/services/cache.ts')).toBe(true);
    expect(report.uploads.diskStorage).toContain('server/routes/upload.ts');
    expect(report.uploads.diskStorage).toContain('qianfu-liandeng/server/routes/upload.ts');
    expect(report.uploads.memoryStorage).toEqual([]);
    expect(report.lifecycle.sse).toContain('server/routes/events.ts');
    expect(report.lifecycle.polling).toContain('qianfu-liandeng/src/pages/paymentPolling.ts');
    expect(report.lifecycle.timers).toContain('server/services/cleanupService.ts');
    expect(report.pm2.configs).toContain('ecosystem.config.cjs');
    expect(report.pm2.sampling.localPm2).toBe(false);
    expect(report.pm2.sampling.heapProfiles).toEqual([]);
  });
});
