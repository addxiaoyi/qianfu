import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'scripts/smoke-api-local.ts'), 'utf8');

describe('local API smoke process lifecycle', () => {
  it('does not wait for an exit event that already occurred', () => {
    expect(source).toMatch(/cp\.exitCode !== null \|\| cp\.signalCode !== null/);
    expect(source).toMatch(/Promise\.resolve\(true\)/);
  });

  it('bounds every process exit wait with an unrefed timer', () => {
    expect(source).toContain('SMOKE_PROCESS_EXIT_TIMEOUT_MS');
    expect(source).toMatch(/Promise<boolean>/);
    expect(source).toMatch(/setTimeout\(\(\) => finish\(false\), timeoutMs\)/);
    expect(source).toContain('timer.unref()');
  });

  it('terminates the full managed process tree on Windows and falls back to SIGTERM', () => {
    expect(source).toMatch(/spawn\('taskkill', \['\/pid', String\(cp\.pid\), '\/t', '\/f'\]/);
    expect(source).toContain('if (await waitForExit(cp)) return');
    expect(source).toContain("cp.kill('SIGTERM')");
    expect(source).toContain('Managed server did not exit before the cleanup timeout');
  });

  it('does not report the managed cleanup exit as an unexpected server failure', () => {
    expect(source).toContain('cleanupRequested');
    expect(source).toMatch(/if \(!cleanupRequested\) \{[\s\S]*Server process exited/);
  });

  it('uses first-party browser headers when probing an explicit base URL', () => {
    expect(source).toContain("'sec-fetch-site': 'same-origin'");
    expect(source).toContain("'sec-fetch-mode': 'cors'");
    expect(source).toContain("referer: `${normalizeBase(base)}/`");
  });
});
