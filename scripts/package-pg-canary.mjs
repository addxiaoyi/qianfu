import fs from 'node:fs/promises';
import path from 'node:path';

const stagingRoot = path.resolve('tmp/pg-canary-staging');
const sourceDist = path.resolve('dist-server');
const sourceSchema = path.resolve('prisma/schema.postgresql.prisma');
const targetDist = path.join(stagingRoot, 'app', 'dist-server');
const targetPrismaDir = path.join(stagingRoot, 'prisma');

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
await copyDir(sourceDist, targetDist);
await fs.mkdir(targetPrismaDir, { recursive: true });
await fs.copyFile(sourceSchema, path.join(targetPrismaDir, 'schema.postgresql.prisma'));

console.log(`Prepared canary staging under ${path.relative(process.cwd(), stagingRoot)}`);
