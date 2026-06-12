import fs from 'node:fs/promises';
import path from 'node:path';

const sourceDir = path.resolve('dist-server/prisma/generated/postgres-client');
const stagingRoot = path.resolve('tmp/postgres-client-staging');
const targetDir = path.join(stagingRoot, 'postgres-client');

async function rmSafe(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

await rmSafe(stagingRoot);
await copyDir(sourceDir, targetDir);
console.log(`Prepared postgres client staging under ${path.relative(process.cwd(), stagingRoot)}`);
