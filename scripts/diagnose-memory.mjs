import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const diagnosticScript = path.join(repoRoot, 'scripts/diagnose-memory.mjs');
const sourceRoots = ['server', 'qianfu-liandeng/server', 'qianfu-liandeng/src'];
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'public', 'docs', 'output', 'tmp', 'uploads']);
const sourceExtensions = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx']);

const rel = file => path.relative(repoRoot, file).replaceAll(path.sep, '/');

const readText = file => {
  try {
    return fs.readFileSync(path.join(repoRoot, file), 'utf8');
  } catch {
    return '';
  }
};

const walk = (root, predicate = () => true) => {
  const absoluteRoot = path.join(repoRoot, root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (predicate(absolute)) files.push(absolute);
    }
  };
  visit(absoluteRoot);
  return files;
};

const sourceFiles = sourceRoots.flatMap(root => walk(root, file => sourceExtensions.has(path.extname(file))));

const filesContaining = (patterns, files = sourceFiles) => files
  .filter(file => {
    const source = fs.readFileSync(file, 'utf8');
    return patterns.some(pattern => pattern.test(source));
  })
  .map(rel)
  .sort();

const evidenceLines = (file, patterns) => readText(file)
  .split(/\r?\n/)
  .map((line, index) => ({ line: index + 1, text: line.trim() }))
  .filter(({ text }) => patterns.some(pattern => pattern.test(text)))
  .slice(0, 20);

const cacheFiles = [
  'server/services/cache.ts',
  'server/services/redisService.ts',
  'server/intelligent-probe/services/minecraftProbeService.ts',
  'server/services/serverStatusHistoryService.ts',
];

const pm2Configs = ['ecosystem.config.cjs', 'ecosystem.config.js', 'ecosystem.microservices.config.js']
  .filter(file => fs.existsSync(path.join(repoRoot, file)));

const heapProfiles = sourceRoots.flatMap(root => walk(root, file => /\.(heapprofile|heapsnapshot)$/i.test(file)))
  .map(rel)
  .sort();

const hasLocalPm2 = () => {
  try {
    execFileSync('pm2', ['--version'], { cwd: repoRoot, stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

const report = {
  caches: cacheFiles
    .filter(file => readText(file))
    .map(file => ({
      file,
      evidence: evidenceLines(file, [/maxSize/, /maxEntries/, /statusCache/, /lastWriteAt/, /cleanup/])
        .map(item => `${item.line}: ${item.text}`),
    })),
  uploads: {
    memoryStorage: filesContaining([/multer\.memoryStorage\(\)/]),
    diskStorage: filesContaining([/multer\.diskStorage\(/]),
  },
  lifecycle: {
    sse: filesContaining([/text\/event-stream/, /EventSource/]),
    polling: filesContaining([/paymentPolling/, /createPaymentPoller/]),
    timers: filesContaining([/setInterval\(/]).filter(file => /cleanup|metrics|memoryPressure|cache|Probe|CallbackQueue|ReconciliationJob/i.test(file)),
  },
  pm2: {
    configs: pm2Configs,
    sampling: {
      localPm2: hasLocalPm2(),
      heapProfiles,
      evidence: filesContaining([/heap|sampling|inspector|heapprofile|pmx/i], [
        ...pm2Configs.map(file => path.join(repoRoot, file)),
        path.join(repoRoot, 'package.json'),
      ].filter(file => file !== diagnosticScript)),
    },
  },
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('Memory diagnosis (read-only)');
  console.log(`Caches: ${report.caches.length} inspected`);
  for (const item of report.caches) console.log(`- ${item.file}: ${item.evidence.join(' | ') || 'no matching evidence'}`);
  console.log(`Multer memoryStorage: ${report.uploads.memoryStorage.join(', ') || 'none'}`);
  console.log(`Multer diskStorage: ${report.uploads.diskStorage.join(', ') || 'none'}`);
  console.log(`SSE surfaces: ${report.lifecycle.sse.join(', ') || 'none'}`);
  console.log(`Payment polling: ${report.lifecycle.polling.join(', ') || 'none'}`);
  console.log(`Timer surfaces: ${report.lifecycle.timers.join(', ') || 'none'}`);
  console.log(`PM2 configs: ${report.pm2.configs.join(', ') || 'none'}`);
  console.log(`Local PM2: ${report.pm2.sampling.localPm2 ? 'available' : 'not found'}`);
  console.log(`Heap profiles: ${report.pm2.sampling.heapProfiles.join(', ') || 'none'}`);
  console.log(`Heap sampling references: ${report.pm2.sampling.evidence.join(', ') || 'none'}`);
}
