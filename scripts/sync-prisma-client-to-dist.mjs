import fs from 'node:fs/promises';
import path from 'node:path';

const targetRoot = path.resolve(process.argv[2] ?? 'dist-server');

const copies = [
  {
    sourceDir: path.resolve('prisma/generated/client'),
    targetDir: path.join(targetRoot, 'prisma/generated/client'),
  },
  {
    sourceDir: path.resolve('prisma/generated/local-client'),
    targetDir: path.join(targetRoot, 'prisma/generated/local-client'),
  },
  {
    sourceDir: path.resolve('prisma/generated/postgres-client'),
    targetDir: path.join(targetRoot, 'prisma/generated/postgres-client'),
  },
  {
    sourceDir: path.resolve('prisma/generated/mysql-client'),
    targetDir: path.join(targetRoot, 'prisma/generated/mysql-client'),
  },
];

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.includes('.tmp')) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

for (const { sourceDir, targetDir } of copies) {
  try {
  await copyDir(sourceDir, targetDir);
  console.log(`Copied Prisma client from ${sourceDir} to ${targetDir}`);
  } catch (error) {
    if ((error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      continue;
    }
    throw error;
  }
}
