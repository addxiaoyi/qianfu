import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readScript = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Baota release contracts', () => {
  it('builds the server bundle before packaging a production release', () => {
    const packageJson = JSON.parse(readScript('package.json')) as { scripts?: Record<string, string> };
    const preflight = packageJson.scripts?.['release:preflight'] ?? '';

    expect(preflight).toContain('npm run server:build');
    expect(preflight.indexOf('npm run build')).toBeLessThan(preflight.indexOf('npm run validate'));
    expect(preflight.indexOf('npm run server:build')).toBeLessThan(preflight.indexOf('npm run validate:env'));
  });

  it('captures a recoverable production snapshot without copying environment values', () => {
    const script = readScript('scripts/linux/snapshot-baota-release.sh');

    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('--check-only');
    expect(script).toContain('/www/backup/qianfu/releases');
    expect(script).toContain('cut -d= -f1');
    expect(script).toContain('mysqldump');
    expect(script).toContain('pm2 jlist');
    expect(script).toContain('SQLITE_DB_PATH');
    expect(script).toContain('command -v sqlite3');
    expect(script).toContain('.backup');
    expect(script).toContain('chmod 700 "$snapshot_dir" "$snapshot_dir/nginx" "$snapshot_dir/cert"');
    expect(script).toContain('find . -type f ! -name SHA256SUMS');
    expect(script).not.toMatch(/\bcp\b[^\n]*\.env/);
  });

  it('selects PostgreSQL pg_dump from DATABASE_URL before considering a stale SQLite file', () => {
    const script = readScript('scripts/linux/snapshot-baota-release.sh');
    const selector = script.match(/select_database_backup\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(script).toContain('PGDUMP_BIN="${PGDUMP_BIN:-pg_dump}"');
    expect(script).toContain('backup_postgresql()');
    expect(script).toContain('"$PGDUMP_BIN"');
    expect(script).toContain('normalize_postgres_url()');
    expect(script).toContain('normalized_database_url');
    expect(script).toContain('url.searchParams.delete(key)');
    expect(script).toContain('database_url="${DATABASE_URL:-}"');
    expect(script).toContain('database_url="$(awk -F=');
    expect(script).toMatch(/DATABASE_URL.*postgres|postgres.*DATABASE_URL/);
    expect(selector).toContain('postgres://*|postgresql://*');
    expect(selector).toContain('file:*)');
    expect(selector.indexOf('postgresql')).toBeGreaterThanOrEqual(0);
    expect(selector.indexOf('postgresql')).toBeLessThan(selector.indexOf('SQLITE_DB_PATH'));
    expect(selector.indexOf('file:*)')).toBeLessThan(selector.indexOf('if [[ -s "$SQLITE_DB_PATH" ]]'));
    expect(script).toContain('DATABASE_BACKUP_MODE must be auto, sqlite, mysql, or postgresql');
    expect(script).toContain('DATABASE_BACKUP_MODE" == "mysql"');
    expect(script).toContain('DATABASE_BACKUP_MODE" == "sqlite"');
  });

  it('publishes staged frontend and server artifacts with an atomic rollback path', () => {
    const script = readScript('scripts/linux/publish-baota-release.sh');
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(script).toContain('dist-server');
    expect(script).toContain('packages/shared/dist');
    expect(script).toContain('qianfu-liandeng/dist');
    expect(script).toContain('node_modules/@aws-sdk/s3-request-presigner');
    expect(runner).toContain('payload/node_modules/@aws-sdk/s3-request-presigner');
    expect(script).toContain('mv -Tf');
    expect(script).toContain('API_STARTUP_TIMEOUT_SECONDS=90');
    expect(script).toContain('--rollback');
    expect(script).toContain('bash "$stage_dir/scripts/linux/snapshot-baota-release.sh"');
    expect(script).toContain('APP_RELEASES_ROOT');
    expect(script).toContain('cp -al "$previous_app/." "$next_app"');
    expect(script).toContain('cp -p "$stage_dir/scripts/linux/publish-baota-release.sh" "$next_app/scripts/linux/publish-baota-release.sh"');
    expect(script).toContain('cp -p "$stage_dir/scripts/linux/snapshot-baota-release.sh" "$next_app/scripts/linux/snapshot-baota-release.sh"');
    expect(script.indexOf('rm -f "$next_app/scripts/linux/publish-baota-release.sh"')).toBeLessThan(
      script.indexOf('cp -p "$stage_dir/scripts/linux/publish-baota-release.sh"'),
    );
    expect(script.indexOf('rm -f "$next_app/scripts/linux/snapshot-baota-release.sh"')).toBeLessThan(
      script.indexOf('cp -p "$stage_dir/scripts/linux/snapshot-baota-release.sh"'),
    );
    expect(script.indexOf('rm -f "$next_app/scripts/linux/optimize-prod-disk.sh"')).toBeLessThan(
      script.indexOf('cp -p "$stage_dir/scripts/linux/optimize-prod-disk.sh"'),
    );
    expect(script).toContain('require_file "$previous_app/node_modules/.bin/prisma"');
    expect(script).toContain('"$next_app/node_modules/.bin/prisma" migrate deploy');
    expect(script).not.toContain('$APP_ROOT/node_modules/.bin/prisma');
    expect(script).toContain('migrate deploy');
    expect(script).toContain('pm2 stop qianfu-api');
    expect(script).toContain('pm2 delete qianfu-api');
    expect(script).toContain('pm2 start ecosystem.config.cjs --only qianfu-api --update-env');
    expect(script).toContain('pm2 save');
    expect(script).toContain('cp -p "$previous_app/.env" "$next_app/.env.next-$release_id"');
    expect(script).toContain('mv -f "$next_app/.env.next-$release_id" "$next_app/.env"');
    expect(script).toContain('apply_personal_filing_env "$next_app/.env"');
    expect(script).toContain('values["PERSONAL_FILING_MODE"] = "true"');
    expect(script).toContain('values["DEFAULT_PAYMENT_UPSTREAM_PROVIDER"] = ""');
    expect(script).toContain('values["PAYPRO_ENABLED"] = "false"');
    expect(script).not.toContain('pm2 restart qianfu-api --update-env');
    expect(script).toContain('X-Forwarded-Proto: https');
    expect(script).toContain('/api/health');
    expect(script).toContain('migrate_legacy_frontend');
    expect(script).toContain('current-backup-$release_id');
    expect(script).toContain('[[ -L "$WEB_ROOT/current" ]]');
  });

  it('uses the trusted public host for loopback health checks', () => {
    const script = readScript('scripts/linux/deploy-bt-oneclick.sh');

    expect(script).toContain('PORT="${PORT:-3001}"');
    expect(script).toContain('LOCAL_HEALTH_HOST');
    expect(script).toContain('derive_main_site_host');
    expect(script).toContain('curl -fsS -H "Host: ${LOCAL_HEALTH_HOST}"');
    expect(script).not.toContain('curl -fsS "http://127.0.0.1:${PORT}${path}"');
  });

  it('keeps the www alias as a separately certified canonical redirect', () => {
    const nginx = readScript('deploy/nginx/mc-u.top.conf.example');

    expect(nginx).toContain('server_name www.mc-u.top;');
    expect(nginx).toContain('/etc/letsencrypt/live/www.mc-u.top/fullchain.pem');
    expect(nginx).toContain('return 301 https://mc-u.top$request_uri;');
  });

  it('normalizes server ESM imports before packaging a release', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain('fix-esm-import-extensions.mjs');
    expect(runner).toContain('normalize_esm_imports');
    expect(runner).toContain('subprocess.run');
  });

  it('runs production migrations against the PostgreSQL schema instead of the SQLite staging database', () => {
    const script = readScript('scripts/linux/publish-baota-release.sh');
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(script).toContain('schema.postgresql.prisma');
    expect(script).not.toContain('ln -s "$SQLITE_DB_PATH" "$migration_runner/dev.db"');
    expect(script).not.toContain('require_file "$SQLITE_DB_PATH"');
    expect(script).toContain('--schema "$migration_runner/schema.postgresql.prisma"');
    expect(script).toContain('to_regclass');
    expect(script).toContain('psql');
    expect(script).toContain('migration.postgresql.sql');
    expect(script).toContain('20260731050000_checkin_and_server_facets/migration.postgresql.sql');
    expect(script).toContain('20260731080000_checkin_history_fk_reconciliation/migration.postgresql.sql');
    expect(script).toContain('20260810100000_checkin_unique_constraint_repair/migration.postgresql.sql');
    expect(script).toContain('20260808120000_marketplace_product_asset_columns/migration.postgresql.sql');
    expect(script).toContain('20260810120000_level_xp_events/migration.postgresql.sql');
    expect(runner).toContain("'payload/prisma/schema.postgresql.prisma'");
  });

  it('repairs duplicate legacy check-ins before enforcing daily uniqueness', () => {
    const migration = readScript(
      'prisma/migrations/20260810100000_checkin_unique_constraint_repair/migration.postgresql.sql',
    );

    expect(migration).toContain('DELETE FROM checkin_history');
    expect(migration).toContain('SELECT MIN(id)');
    expect(migration).toContain('GROUP BY user_id, checkin_date');
    expect(migration.indexOf('DELETE FROM')).toBeLessThan(migration.indexOf('CREATE UNIQUE INDEX'));
  });

  it('keeps the PayPal repair migration portable for PostgreSQL', () => {
    const migration = readScript('prisma/migrations/20260805180000_paypal_refund_review/migration.postgresql.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "PaypalPaymentRecord"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "PaypalWebhookEvent"');
    expect(migration).toContain('TIMESTAMP(3)');
    expect(migration).not.toContain('DATETIME');
    expect(migration).not.toContain('AUTOINCREMENT');
  });

  it('ships the level XP event migration in PostgreSQL syntax', () => {
    const migration = readScript('prisma/migrations/20260810120000_level_xp_events/migration.postgresql.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "UserExperienceEvent"');
    expect(migration).toContain('TIMESTAMP(3)');
    expect(migration).not.toContain('DATETIME');
    expect(migration).not.toContain('AUTOINCREMENT');
  });

  it('requires an explicit pinned host before uploading a production release', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain("parser.add_argument('--host', required=True)");
    expect(runner).toContain("parser.add_argument('--host-key-sha256', required=True)");
    expect(runner).toContain("parser.add_argument('--publish-staged', action='store_true')");
    expect(runner).toContain('if args.publish_staged:');
    expect(runner).toContain('get_remote_server_key');
    expect(runner).toContain('auth_password');
    expect(runner).toContain('sys.stdout.buffer.write');
    expect(runner).toContain("'payload/prisma/migrations'");
    expect(runner).toContain("'payload/prisma/schema.prisma'");
    expect(runner).toContain('publish-baota-release.sh');
    expect(runner).toContain('except BaseException:');
    expect(runner).not.toContain('AutoAddPolicy');
    expect(runner).not.toMatch(/print\([^\n]*password/i);
  });

  it('supports pinned-host public-key authentication without exposing a password', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain("parser.add_argument('--identity-file'");
    expect(runner).toContain("os.environ.get('QF_SSH_IDENTITY_FILE'");
    expect(runner).toContain('paramiko.PKey.from_path');
    expect(runner).toContain('transport.auth_publickey');
    expect(runner).toContain("fail('QF_SSH_PASSWORD or --identity-file is required.')");
  });

  it('can bind SSH to a trusted local interface when a tunnel intercepts the default route', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain("parser.add_argument('--bind-address'");
    expect(runner).toContain("os.environ.get('QF_SSH_BIND_ADDRESS'");
    expect(runner).toContain("source_address=(bind_address, 0) if bind_address else None");
  });

  it('validates and reuses a previously built local release bundle after a transient connection failure', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain("parser.add_argument('--reuse-bundle'");
    expect(runner).toContain('def validate_existing_bundle(');
    expect(runner).toContain("manifest.get('release') != release_id");
    expect(runner).toContain('bundle = validate_existing_bundle(release_id) if args.reuse_bundle else build_bundle(release_id)');
  });

  it('removes uploaded bundles after a successful publish and prunes abandoned uploads', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain('def cleanup_upload_command(');
    expect(runner).toContain("f'rm -f -- {shell_quote(remote_bundle)};'");
    expect(runner).toContain("-name 'qianfu-baota-release-*.tar.gz' -mtime +1 -delete;");
    expect(runner).toContain('run_remote(client, cleanup_upload_command(args, remote_bundle))');
  });

  it('builds release archives atomically and reports truncated reusable bundles', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain("pending_bundle = bundle.with_name(f'{bundle.name}.tmp')");
    expect(runner).toContain('pending_bundle.replace(bundle)');
    expect(runner).toContain('pending_bundle.unlink(missing_ok=True)');
    expect(runner).toContain('except (OSError, EOFError, tarfile.TarError');
  });

  it('prevents concurrent bundle uploads and release switches from the same workspace', () => {
    const runner = readScript('scripts/deploy-baota-release.py');

    expect(runner).toContain('def acquire_release_lock()');
    expect(runner).toContain("'.deploy-baota.lock'");
    expect(runner).toContain('msvcrt.LK_NBLCK');
    expect(runner).toContain('fcntl.LOCK_EX | fcntl.LOCK_NB');
    expect(runner).toContain('Another Baota release is already running in this workspace.');
    expect(runner.indexOf('\n    acquire_release_lock()\n')).toBeLessThan(runner.indexOf('build_bundle(release_id)'));
  });
});
