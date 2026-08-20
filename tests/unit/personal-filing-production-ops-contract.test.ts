import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('personal filing production smoke contract', () => {
  const smoke = read('scripts/linux/qianfu-prod-smoke.sh');

  it('proves commercial boundaries are closed without requiring a payment provider', () => {
    expect(smoke).toContain('check wallet_boundary 403 /api/v1/wallet/balance');
    expect(smoke).toContain('PERSONAL_FILING_DISABLED');
    expect(smoke).not.toContain('8889');
    expect(smoke).not.toContain('paypro');
  });

  it('keeps anonymous and public availability checks fail-closed', () => {
    expect(smoke).toContain('set -euo pipefail');
    expect(smoke).toContain('check health 200 /api/health');
    expect(smoke).toContain('check profile_boundary 401 /api/v1/profile');
    expect(smoke).toContain('check github_oauth 302 /api/v1/auth/github/start');
    expect(smoke).toContain('smoke failed:');
  });
});

describe('SQLite production backup contract', () => {
  const backup = read('scripts/linux/qianfu-sqlite-backup.sh');
  const service = read('deploy/systemd/qianfu-sqlite-backup.service');

  it('uses an explicit production database path and publishes atomically', () => {
    expect(backup).toContain('QIANFU_LOCAL_DB_PATH:-/www/wwwroot/qianfu-app/prisma/dev.db');
    expect(backup).toContain('sqlite3 -readonly "$DB_PATH"');
    expect(backup).toContain('.backup');
    expect(backup).toContain('.tmp');
    expect(backup).toContain('mv -f "$tmp" "$final"');
    expect(backup).toContain('PRAGMA integrity_check;');
  });

  it('allows the sandbox to read the database directory while limiting writes', () => {
    expect(service).toContain('ProtectSystem=strict');
    expect(service).toContain('ReadWritePaths=/www/wwwroot/qianfu-app/prisma /www/backup/qianfu/sqlite /var/lib/qianfu-monitor');
  });
});
