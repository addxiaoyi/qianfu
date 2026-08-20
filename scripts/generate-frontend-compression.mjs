
import { constants as zlibConstants, brotliCompress, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

export const DEFAULT_MIN_BYTES = 1024;
export const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css', '.csv', '.html', '.htm', '.js', '.json', '.map', '.mjs', '.svg', '.txt',
  '.wasm', '.webmanifest', '.xml',
]);
const EXCLUDED_NAMES = new Set(['qianfu-dist-manifest.json']);
const VARIANTS = [
  { suffix: '.br', encoding: 'br' },
  { suffix: '.gz', encoding: 'gzip' },
];

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export function isCompressedVariant(file) {
  return file.endsWith('.br') || file.endsWith('.gz');
}

export function isCompressibleFile(file) {
  if (isCompressedVariant(file) || EXCLUDED_NAMES.has(path.basename(file))) return false;
  return COMPRESSIBLE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

export async function listDistFiles(distDir) {
  const root = path.resolve(distDir);
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          absolutePath,
          relativePath: toPosix(path.relative(root, absolutePath)),
        });
      }
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function createCompressedBuffers(source) {
  const [brotli, gzipped] = await Promise.all([
    brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_GENERIC,
      },
    }),
    gzipAsync(source, { level: 9, mtime: 0 }),
  ]);

  return { br: brotli, gzip: gzipped };
}

async function writeIfChanged(file, content) {
  try {
    const current = await readFile(file);
    if (current.equals(content)) return false;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
}

async function removeIfPresent(file) {
  try {
    await unlink(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function normalizedOptions(options = {}) {
  const minBytes = Number(options.minBytes ?? DEFAULT_MIN_BYTES);
  if (!Number.isFinite(minBytes) || minBytes < 0) {
    throw new Error(`Invalid compression minimum size: ${options.minBytes}`);
  }

  return {
    distDir: path.resolve(options.distDir || 'qianfu-liandeng/dist'),
    minBytes: Math.floor(minBytes),
  };
}

export async function generateCompression(options = {}) {
  const config = normalizedOptions(options);
  const inventory = await listDistFiles(config.distDir);
  const generated = [];
  const unchanged = [];
  const removed = [];
  const skipped = [];

  for (const file of inventory.filter((entry) => isCompressedVariant(entry.relativePath))) {
    const suffix = file.relativePath.endsWith('.br') ? '.br' : '.gz';
    const sourcePath = file.absolutePath.slice(0, -suffix.length);
    if (!await exists(sourcePath) || !isCompressibleFile(sourcePath)) {
      await unlink(file.absolutePath);
      removed.push(file.relativePath);
    }
  }

  const sources = (await listDistFiles(config.distDir))
    .filter((entry) => isCompressibleFile(entry.relativePath));

  for (const sourceFile of sources) {
    const source = await readFile(sourceFile.absolutePath);
    if (source.length < config.minBytes) {
      skipped.push({ path: sourceFile.relativePath, reason: 'below_min_bytes', bytes: source.length });
      for (const variant of VARIANTS) {
        const variantPath = `${sourceFile.absolutePath}${variant.suffix}`;
        if (await removeIfPresent(variantPath)) {
          removed.push(`${sourceFile.relativePath}${variant.suffix}`);
        }
      }
      continue;
    }

    const compressed = await createCompressedBuffers(source);
    for (const variant of VARIANTS) {
      const content = compressed[variant.encoding];
      const relativePath = `${sourceFile.relativePath}${variant.suffix}`;
      const variantPath = `${sourceFile.absolutePath}${variant.suffix}`;

      if (content.length >= source.length) {
        skipped.push({
          path: relativePath,
          reason: 'not_smaller',
          bytes: content.length,
          sourceBytes: source.length,
        });
        if (await removeIfPresent(variantPath)) removed.push(relativePath);
        continue;
      }

      const changed = await writeIfChanged(variantPath, content);
      const item = {
        path: relativePath,
        source: sourceFile.relativePath,
        encoding: variant.encoding,
        bytes: content.length,
        sourceBytes: source.length,
      };
      (changed ? generated : unchanged).push(item);
    }
  }

  return {
    schemaVersion: 1,
    distDir: config.distDir,
    minBytes: config.minBytes,
    summary: {
      sources: sources.length,
      generated: generated.length,
      unchanged: unchanged.length,
      removed: removed.length,
      skipped: skipped.length,
    },
    generated,
    unchanged,
    removed: removed.sort(),
    skipped,
  };
}

export function parseArgs(argv) {
  let distDir = 'qianfu-liandeng/dist';
  let minBytes = Number(process.env.FRONTEND_COMPRESSION_MIN_BYTES || DEFAULT_MIN_BYTES);
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--min-bytes' && argv[index + 1]) {
      minBytes = Number(argv[++index]);
    } else if (token === '--quiet') {
      quiet = true;
    } else if (!token.startsWith('--')) {
      distDir = token;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return { distDir, minBytes, quiet };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await generateCompression(options);
  if (!options.quiet) console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
