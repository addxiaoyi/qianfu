import fs from 'node:fs/promises';
import path from 'node:path';

const stagingRoot = path.resolve('tmp/pg-overlay-staging');

const files = [
  'dist-server/server/db.js',
  'dist-server/server/localDb.js',
  'dist-server/server/intelligent-probe/db.js',
  'dist-server/server/services/backupService.js',
  'dist-server/server/services/dbOptimizer.js',
  'dist-server/server/controllers/userLevelController.js',
  'dist-server/server/utils/dbProvider.js',
  'dist-server/server/utils/prismaClientResolver.js',
  'dist-server/scripts/backup-db.js',
];

async function rmSafe(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

await rmSafe(stagingRoot);

for (const rel of files) {
  const src = path.resolve(rel);
  const dest = path.join(stagingRoot, rel);
  await ensureParent(dest);
  await fs.copyFile(src, dest);
}

console.log(`Prepared pg overlay staging under ${path.relative(process.cwd(), stagingRoot)}`);
