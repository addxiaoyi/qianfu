import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('production backup contract', () => {
  const backup = read('scripts/linux/backup-postgres-production.sh');

  it('fails safely and prevents overlapping backup jobs', () => {
    expect(backup).toContain('set -euo pipefail');
    expect(backup).toMatch(/exec 9>.*backup\.lock/);
    expect(backup).toMatch(/flock -n 9/);
    expect(backup).toContain('backup.failed');
  });

  it('validates a custom-format dump before atomic publication', () => {
    expect(backup).toMatch(/pg_dump --format=custom/);
    expect(backup).toMatch(/pg_restore --list "\$pending"/);
    expect(backup).toMatch(/\.dump\.pending/);
    expect(backup).toMatch(/mv "\$pending" "\$backup"/);
    expect(backup.indexOf('pg_restore --list')).toBeLessThan(backup.indexOf('mv "$pending" "$backup"'));
  });

  it('enforces bounded retention without deleting unrelated files', () => {
    expect(backup).toMatch(/find "\$BACKUP_DIR" -maxdepth 1 -type f -name 'qianfu-\*\.dump'/);
    expect(backup).toMatch(/awk -v keep="\$KEEP_COUNT"/);
    expect(backup).toMatch(/rm -f -- "\$old_backup"/);
  });

  it('is scheduled persistently and sandboxed by systemd', () => {
    const timer = read('deploy/systemd/qianfu-postgres-backup.timer');
    const service = read('deploy/systemd/qianfu-postgres-backup.service');
    expect(timer).toContain('Persistent=true');
    expect(timer).toMatch(/OnCalendar=.*03:20:00/);
    expect(service).toContain('NoNewPrivileges=true');
    expect(service).toContain('ProtectSystem=strict');
    expect(service).toMatch(/ReadWritePaths=.*postgres.*qianfu-monitor/);
  });
});

describe('production monitor transition contract', () => {
  const monitor = read('scripts/linux/monitor-production.sh');

  it('requires repeated API failures before alerting', () => {
    expect(monitor).toMatch(/api_fail_count >= 3/);
    expect(monitor).toContain('api-fail-count');
    expect(monitor).toMatch(/printf '0\\n' > "\$api_fail_file"/);
  });

  it('alerts only newly observed issue codes', () => {
    expect(monitor).toMatch(/if ! grep -qxF "\$code" "\$previous_codes"/);
    expect(monitor).toContain('系统监控告警');
    expect(monitor).toContain('ALERT $code');
  });

  it('emits recovery notifications only when a previous issue disappears', () => {
    expect(monitor).toMatch(/if ! grep -qxF "\$recovered_code" "\$current_codes"/);
    expect(monitor).toContain('系统监控恢复');
    expect(monitor).toContain('RECOVERED $recovered_code');
  });

  it('detects stale and failed backups', () => {
    expect(monitor).toContain('BACKUP_MAX_AGE_SECONDS');
    expect(monitor).toContain('backup.failed');
    expect(monitor).toContain('qianfu-postgres-backup.service');
  });

  it('alerts on sustained swap pressure', () => {
    expect(monitor).toContain('QIANFU_SWAP_LIMIT_PERCENT');
    expect(monitor).toContain('SwapTotal');
    expect(monitor).toContain('SwapFree');
    expect(monitor).toMatch(/swap_percent >= SWAP_LIMIT/);
  });

  it('alerts when application release retention drifts', () => {
    expect(monitor).toContain('QIANFU_RELEASE_LIMIT');
    expect(monitor).toContain('QIANFU_RELEASE_ROOT');
    expect(monitor).toMatch(/release_count > RELEASE_LIMIT/);
    expect(monitor).toMatch(/-name '\[0-9\]\[0-9\]\[0-9\]\[0-9\]\[0-9\]\[0-9\]\[0-9\]\[0-9\]-\*'/);
  });
});

describe('production healthcheck boundary contract', () => {
  const healthcheck = read('scripts/linux/qianfu-prod-healthcheck.sh');

  it('does not bypass TLS certificate validation', () => {
    expect(healthcheck).not.toMatch(/curl\s+-k/);
    expect(healthcheck).toContain('curl --fail --silent --show-error');
  });

  it('checks the PostgreSQL production backend instead of a MySQL port', () => {
    expect(healthcheck).not.toContain('MYSQL_SERVICE');
    expect(healthcheck).not.toContain(':3306');
    expect(healthcheck).not.toContain('Skipped MySQL');
    expect(healthcheck).toContain('pg_isready');
    expect(healthcheck).toContain('PostgreSQL');
  });
});

describe('personal filing README contract', () => {
  const readme = read('README.md');

  it('describes the current non-transactional product boundary', () => {
    expect(readme).not.toContain('支付集成');
    expect(readme).toContain('个人备案模式');
    expect(readme).toContain('服务器发现');
  });
});

describe('production SSH target contract', () => {
  it('defaults recovery runners to the current Qianfu host', () => {
    const sshRunner = read('scripts/windows/invoke-prod-restore-ssh.ps1');
    const passwordRunner = read('scripts/remote_restore_password.py');

    expect(sshRunner).toContain('else { "121.196.161.249" }');
    expect(passwordRunner).toContain('os.environ.get("QF_SSH_HOST", "121.196.161.249")');
    expect(sshRunner).not.toContain('else { "103.236.92.10" }');
    expect(passwordRunner).not.toContain('os.environ.get("QF_SSH_HOST", "103.236.92.10")');
  });
});
