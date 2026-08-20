
import { brotliDecompress, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MIN_BYTES,
  createCompressedBuffers,
  isCompressibleFile,
  isCompressedVariant,
  listDistFiles,
} from './generate-frontend-compression.mjs';

const gunzipAsync = promisify(gunzip);
const brotliDecompressAsync = promisify(brotliDecompress);
const VARIANTS = [
  { suffix: '.br', encoding: 'br', decompress: brotliDecompressAsync },
  { suffix: '.gz', encoding: 'gzip', decompress: gunzipAsync },
];

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

export async function verifyCompression(options = {}) {
  const config = normalizedOptions(options);
  const inventory = await listDistFiles(config.distDir);
  const byPath = new Map(inventory.map((entry) => [entry.relativePath, entry]));
  const findings = [];
  const findingKeys = new Set();

  const addFinding = (code, target, message) => {
    const key = `${code}\0${target}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push({ code, target, message });
  };

  for (const variantFile of inventory.filter((entry) => isCompressedVariant(entry.relativePath))) {
    const suffix = variantFile.relativePath.endsWith('.br') ? '.br' : '.gz';
    const sourcePath = variantFile.relativePath.slice(0, -suffix.length);
    if (!byPath.has(sourcePath) || !isCompressibleFile(sourcePath)) {
      addFinding(
        'orphan_compressed_variant',
        variantFile.relativePath,
        `compressed variant has no eligible source: ${sourcePath}`,
      );
    }
  }

  const sources = inventory.filter((entry) => isCompressibleFile(entry.relativePath));
  let expectedVariants = 0;
  let verifiedVariants = 0;

  for (const sourceFile of sources) {
    const source = await readFile(sourceFile.absolutePath);
    const compressed = source.length >= config.minBytes
      ? await createCompressedBuffers(source)
      : null;

    for (const variant of VARIANTS) {
      const variantRelative = `${sourceFile.relativePath}${variant.suffix}`;
      const variantFile = byPath.get(variantRelative);
      const expected = compressed?.[variant.encoding];
      const beneficial = Boolean(expected && expected.length < source.length);

      if (!beneficial) {
        if (variantFile) {
          addFinding(
            'unexpected_compressed_variant',
            variantRelative,
            source.length < config.minBytes
              ? `source is below ${config.minBytes} bytes`
              : 'compressed output is not smaller than source',
          );
        }
        continue;
      }

      expectedVariants += 1;
      if (!variantFile) {
        addFinding(
          'missing_compressed_variant',
          variantRelative,
          `missing ${variant.encoding} asset for ${sourceFile.relativePath}`,
        );
        continue;
      }

      let actual;
      try {
        actual = await readFile(variantFile.absolutePath);
      } catch (error) {
        addFinding(
          'unreadable_compressed_variant',
          variantRelative,
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }

      if (!actual.equals(expected)) {
        addFinding(
          'compressed_variant_mismatch',
          variantRelative,
          `deterministic ${variant.encoding} bytes do not match the source`,
        );
        continue;
      }

      try {
        const restored = await variant.decompress(actual);
        if (!restored.equals(source)) {
          addFinding(
            'compressed_variant_content_mismatch',
            variantRelative,
            'decompressed bytes do not match the source',
          );
          continue;
        }
      } catch (error) {
        addFinding(
          'compressed_variant_invalid',
          variantRelative,
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }

      verifiedVariants += 1;
    }
  }

  return {
    schemaVersion: 1,
    ok: findings.length === 0,
    distDir: config.distDir,
    minBytes: config.minBytes,
    summary: {
      sources: sources.length,
      expectedVariants,
      verifiedVariants,
      findings: findings.length,
    },
    findings,
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
  const report = await verifyCompression(options);
  if (!options.quiet || !report.ok) console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
