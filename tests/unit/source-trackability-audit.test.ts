// @vitest-environment node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const auditScript = path.resolve(process.cwd(), 'scripts/audit-source-trackability.cjs');
const sourceManifestScript = path.resolve(process.cwd(), 'scripts/source-manifest.mjs');
const temporaryRoots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'qianfu-trackability-'));
  temporaryRoots.push(root);
  return root;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runAudit(root: string, extraArgs: string[] = []) {
  return spawnSync(
    process.execPath,
    [auditScript, '--root', root, '--report', 'audit-report.json', ...extraArgs],
    { encoding: 'utf8' },
  );
}

function initializeGit(root: string): void {
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'audit@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Audit Test'], { cwd: root });
}

function sri(byte: string): string {
  return `sha256-${Buffer.alloc(32, byte).toString('base64')}`;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('source trackability audit', () => {
  it('passes tracked script entries and blocks an ignored critical script', () => {
    const root = createRoot();
    initializeGit(root);
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    writeJson(path.join(root, 'package.json'), {
      name: 'audit-fixture',
      scripts: { quality: 'node scripts/tracked.cjs' },
    });
    writeFileSync(path.join(root, 'scripts/tracked.cjs'), "console.log('tracked');\n", 'utf8');
    writeFileSync(path.join(root, '.gitignore'), '', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: root });

    const passing = runAudit(root);
    expect(passing.status, `${passing.stdout}\n${passing.stderr}`).toBe(0);
    const passingReport = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(passingReport.mode).toBe('git');
    expect(passingReport.summary.errors).toBe(0);

    writeJson(path.join(root, 'package.json'), {
      name: 'audit-fixture',
      scripts: { quality: 'node scripts/ignored.cjs' },
    });
    writeFileSync(path.join(root, '.gitignore'), 'scripts/ignored.cjs\n', 'utf8');
    writeFileSync(path.join(root, 'scripts/ignored.cjs'), "console.log('ignored');\n", 'utf8');

    const failing = runAudit(root);
    expect(failing.status).toBe(1);
    const failingReport = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(failingReport.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'package-script-entry',
        status: 'error',
        target: 'scripts/ignored.cjs',
      }),
    ]));
  }, 20_000);

  it('accepts an untracked file only while its source manifest hash matches', () => {
    const root = createRoot();
    initializeGit(root);
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    writeJson(path.join(root, 'package.json'), {
      name: 'manifest-fixture',
      scripts: { quality: 'node scripts/untracked.cjs' },
    });
    writeFileSync(path.join(root, '.gitignore'), '', 'utf8');
    writeFileSync(path.join(root, 'scripts/untracked.cjs'), "console.log('manifest');\\n", 'utf8');
    execFileSync('git', ['add', 'package.json', '.gitignore'], { cwd: root });
    execFileSync(
      process.execPath,
      [
        sourceManifestScript,
        '--root', root,
        '--output', 'reports/source-manifest.json',
        '--quiet',
      ],
      { cwd: root },
    );

    const passing = runAudit(root, [
      '--source-manifest', 'reports/source-manifest.json',
      '--require-source-manifest',
    ]);
    expect(passing.status, `${passing.stdout}
${passing.stderr}`).toBe(0);

    writeFileSync(path.join(root, 'scripts/untracked.cjs'), "console.log('changed');\\n", 'utf8');
    const failing = runAudit(root, [
      '--source-manifest', 'reports/source-manifest.json',
      '--require-source-manifest',
    ]);
    expect(failing.status).toBe(1);
    const report = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'source-manifest',
        status: 'error',
        target: 'scripts/untracked.cjs',
        code: 'source_manifest_file_changed',
      }),
    ]));
  }, 20_000);

  it('skips local runtime snapshots during recursive source inspection', () => {
    const root = createRoot();
    initializeGit(root);
    writeJson(path.join(root, 'package.json'), { name: 'runtime-fixture', scripts: {} });
    writeFileSync(path.join(root, '.gitignore'), '.runtime/\n', 'utf8');
    mkdirSync(path.join(root, '.runtime', 'historical-release'), { recursive: true });
    writeFileSync(
      path.join(root, '.runtime', 'historical-release', 'broken.cjs'),
      "require('./missing-module');\n",
      'utf8',
    );
    execFileSync('git', ['add', 'package.json', '.gitignore'], { cwd: root });

    const result = runAudit(root);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const report = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(report.summary.errors).toBe(0);
  }, 20_000);

  it('requires buildId-bound SRI for built HTML and service-worker precache assets', () => {
    const root = createRoot();
    const dist = path.join(root, 'qianfu-liandeng', 'dist');
    mkdirSync(path.join(dist, 'assets'), { recursive: true });
    writeJson(path.join(root, 'package.json'), { name: 'release-fixture', scripts: {} });
    writeFileSync(
      path.join(dist, 'index.html'),
      '<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">',
      'utf8',
    );
    writeFileSync(path.join(dist, 'assets/app.js'), 'export const ready = true;\n', 'utf8');
    writeFileSync(path.join(dist, 'assets/app.css'), 'body{}\n', 'utf8');
    writeJson(path.join(dist, 'manifest.json'), { name: 'fixture' });
    writeFileSync(
      path.join(dist, 'sw.js'),
      'const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];\n',
      'utf8',
    );

    const buildId = 'a'.repeat(64);
    const files = [
      ['/index.html', '1'],
      ['/assets/app.js', '2'],
      ['/assets/app.css', '3'],
      ['/manifest.json', '4'],
      ['/sw.js', '5'],
    ].map(([assetPath, byte]) => ({
      path: assetPath,
      bytes: 1,
      sha256: byte.repeat(64),
      sri: sri(byte),
    }));
    writeJson(path.join(dist, 'qianfu-dist-manifest.json'), {
      schemaVersion: 2,
      buildId,
      distHash: buildId,
      files,
    });

    const passing = runAudit(root, ['--require-dist']);
    expect(passing.status, `${passing.stdout}\n${passing.stderr}`).toBe(0);
    const passingReport = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(passingReport.summary.errors).toBe(0);

    delete files.find((entry) => entry.path === '/manifest.json')!.sri;
    writeJson(path.join(dist, 'qianfu-dist-manifest.json'), {
      schemaVersion: 2,
      buildId,
      distHash: buildId,
      files,
    });
    const failing = runAudit(root, ['--require-dist']);
    expect(failing.status).toBe(1);
    const failingReport = JSON.parse(readFileSync(path.join(root, 'audit-report.json'), 'utf8'));
    expect(failingReport.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'service-worker-precache',
        status: 'error',
        target: '/manifest.json',
      }),
    ]));
  });
});
