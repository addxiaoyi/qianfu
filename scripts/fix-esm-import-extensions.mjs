import fs from 'node:fs/promises';
import path from 'node:path';

const targetRoot = process.argv[2];

if (!targetRoot) {
  console.error('Usage: node scripts/fix-esm-import-extensions.mjs <target-root>');
  process.exit(1);
}

const root = path.resolve(targetRoot);

const importPattern =
  /((?:import|export)\s+(?:[^'"]*?\s+from\s+)?|import\s*\()\s*(['"])(\.\.?(?:\/[^'"]*)?)\2/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return entry.isFile() && fullPath.endsWith('.js') ? [fullPath] : [];
    })
  );
  return files.flat();
}

async function resolveSpecifier(filePath, specifier) {
  const basePath = path.resolve(path.dirname(filePath), specifier);
  const candidates = [
    `${basePath}.js`,
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        const relative = path
          .relative(path.dirname(filePath), candidate)
          .replaceAll(path.sep, '/');
        return relative.startsWith('.') ? relative : `./${relative}`;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function rewriteFile(filePath) {
  const original = await fs.readFile(filePath, 'utf8');
  let changed = false;
  let rewritten = '';
  let lastIndex = 0;

  for (const match of original.matchAll(importPattern)) {
    const [fullMatch, prefix, quote, specifier] = match;
    const matchIndex = match.index ?? 0;
    const replacement = await resolveSpecifier(filePath, specifier);

    rewritten += original.slice(lastIndex, matchIndex);

    if (replacement && replacement !== specifier) {
      rewritten += `${prefix}${quote}${replacement}${quote}`;
      changed = true;
    } else {
      rewritten += fullMatch;
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (!changed) {
    return false;
  }

  rewritten += original.slice(lastIndex);
  await fs.writeFile(filePath, rewritten, 'utf8');
  return true;
}

const files = await walk(root);
let changedCount = 0;

for (const filePath of files) {
  if (await rewriteFile(filePath)) {
    changedCount += 1;
  }
}

console.log(`Rewrote ${changedCount} compiled files under ${root}`);
