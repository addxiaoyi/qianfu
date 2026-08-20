import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/linux/optimize-prod-disk.sh');

describe('production disk cleanup script', () => {
  it('requires an explicit apply flag before deleting anything', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('APPLY=0');
    expect(source).toMatch(/--apply\)/);
    expect(source).toContain('if [[ "$APPLY" != "1" ]]');
  });

  it('keeps cleanup targets inside the declared production roots', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('/www/wwwroot/qianfu-app');
    expect(source).toContain('/www/wwwroot/qianfu-releases');
    expect(source).toContain('/www/wwwroot/mc-u.top');
    expect(source).toContain('/mnt/qianfu-data/backups');
    expect(source).toContain('safe_child');
  });

  it('ignores hidden control directories in the release root', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('is_release_name');
    expect(source).toMatch(/\^\[0-9\]\{8\}-\[A-Za-z0-9\]/);
    expect(source).toContain('is_release_name "$path" || continue');
  });

  it('protects every active and rollback target from cleanup', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('protected_targets');
    expect(source).toContain('"$current_app"');
    expect(source).toContain('"$current_release"');
    expect(source).toContain('"$current_web"');
    expect(source).toContain('rollback_targets');
  });

  it('cleans the release root used by the active Baota symlink layout', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('RELEASE_ROOT="${QF_RELEASE_ROOT:-/www/wwwroot/qianfu-releases}"');
    expect(source).toContain('collect_old_directories "$RELEASE_ROOT"');
    expect(source).toContain('current_release');
  });

  it('cleans stale frontend releases without deleting rollback targets', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('FRONTEND_RELEASE_ROOT="${QF_FRONTEND_RELEASE_ROOT:-$WEB_ROOT/releases}"');
    expect(source).toContain('collect_old_directories "$FRONTEND_RELEASE_ROOT"');
    expect(source).toContain('rollback_targets');
    expect(source).toContain('app-target');
    expect(source).toContain('frontend-target');
    expect(source).toContain('ROLLBACK_KEEP');
    expect(source).toContain('rollback_kept');
  });

  it('reports database backups without deleting them by default', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain('database backups are report-only');
    expect(source).not.toMatch(/rm[^\n]*BACKUP_ROOT/);
  });

  it('is included in the recovery bundle', () => {
    const bundleScript = readFileSync(resolve('scripts/linux/package-prod-restore-bundle.sh'), 'utf8');

    expect(bundleScript).toContain('require_file scripts/linux/optimize-prod-disk.sh');
    expect(bundleScript).toContain('copy_path scripts/linux/optimize-prod-disk.sh');
  });

  it('is carried into the atomic Baota release', () => {
    const runner = readFileSync(resolve('scripts/deploy-baota-release.py'), 'utf8');
    const publisher = readFileSync(resolve('scripts/linux/publish-baota-release.sh'), 'utf8');

    expect(runner).toContain('scripts/linux/optimize-prod-disk.sh');
    expect(publisher).toContain('optimize-prod-disk.sh');
  });
});
