import path from 'node:path';
import { fromBufferPromise, validateFileName } from 'yauzl';
export const ARCHIVE_LIMITS = Object.freeze({
    maxEntries: 4096,
    maxPathDepth: 32,
    maxNestingDepth: 3,
    maxEntryUncompressedBytes: 128 * 1024 * 1024,
    maxArchiveUncompressedBytes: 256 * 1024 * 1024,
    maxTotalExpandedBytes: 512 * 1024 * 1024,
    maxNestedArchiveBytes: 32 * 1024 * 1024,
    maxCompressionRatio: 250,
    maxFileNameBytes: 1024,
});
const ARCHIVE_SUFFIXES = ['.zip', '.jar'];
function archiveError(message) {
    return new Error(`Unsafe archive: ${message}`);
}
function normalizeEntryName(fileName) {
    if (!fileName || fileName.includes('\0'))
        throw archiveError('empty or null-containing entry name');
    if (Buffer.byteLength(fileName, 'utf8') > ARCHIVE_LIMITS.maxFileNameBytes) {
        throw archiveError('entry name is too long');
    }
    const slashed = fileName.replace(/\\/g, '/');
    const validationError = validateFileName(slashed);
    if (validationError)
        throw archiveError(validationError);
    if (slashed.startsWith('/') || /^[a-zA-Z]:\//.test(slashed)) {
        throw archiveError(`absolute path is not allowed: ${fileName}`);
    }
    const normalized = path.posix.normalize(slashed).replace(/^\.\//, '').replace(/\/+$/, '');
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw archiveError(`path traversal is not allowed: ${fileName}`);
    }
    const segments = normalized.split('/');
    if (segments.length > ARCHIVE_LIMITS.maxPathDepth) {
        throw archiveError(`entry path is too deep: ${fileName}`);
    }
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw archiveError(`invalid path segment: ${fileName}`);
    }
    return normalized;
}
function unixFileType(entry) {
    const hostSystem = entry.versionMadeBy >>> 8;
    if (hostSystem !== 3)
        return 0;
    return (entry.externalFileAttributes >>> 16) & 0o170000;
}
function assertRegularEntry(entry, normalizedName) {
    const fileType = unixFileType(entry);
    const isDirectory = entry.fileName.endsWith('/');
    if (fileType === 0o120000)
        throw archiveError(`symbolic links are not allowed: ${normalizedName}`);
    if (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000) {
        throw archiveError(`special files are not allowed: ${normalizedName}`);
    }
    if (isDirectory && entry.uncompressedSize !== 0) {
        throw archiveError(`directory entry contains data: ${normalizedName}`);
    }
}
function isNestedArchive(fileName) {
    const lower = fileName.toLowerCase();
    return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}
async function readStreamWithLimit(stream, maxBytes) {
    const chunks = [];
    let total = 0;
    for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes)
            throw archiveError('nested archive exceeds inspection buffer limit');
        chunks.push(buffer);
    }
    return Buffer.concat(chunks, total);
}
async function inspectLevel(buffer, depth, scope, state) {
    if (depth > ARCHIVE_LIMITS.maxNestingDepth)
        throw archiveError('nested archive depth exceeded');
    state.maxDepth = Math.max(state.maxDepth, depth);
    const zipFile = await fromBufferPromise(buffer, {
        autoClose: false,
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
        strictFileNames: true,
    }).catch((error) => {
        throw archiveError(error instanceof Error ? error.message : 'invalid ZIP structure');
    });
    let archiveExpandedBytes = 0;
    try {
        if (zipFile.entryCount > ARCHIVE_LIMITS.maxEntries)
            throw archiveError('entry count exceeded');
        for await (const entry of zipFile.eachEntry()) {
            state.entryCount += 1;
            if (state.entryCount > ARCHIVE_LIMITS.maxEntries)
                throw archiveError('entry count exceeded');
            if (entry.isEncrypted())
                throw archiveError(`encrypted entries are not allowed: ${entry.fileName}`);
            if (!entry.canDecodeFileData() || ![0, 8].includes(entry.compressionMethod)) {
                throw archiveError(`unsupported compression method for ${entry.fileName}`);
            }
            const normalizedName = normalizeEntryName(entry.fileName);
            assertRegularEntry(entry, normalizedName);
            const identity = `${scope}/${normalizedName}`.toLowerCase();
            if (state.seenPaths.has(identity))
                throw archiveError(`duplicate entry path: ${normalizedName}`);
            state.seenPaths.add(identity);
            if (entry.uncompressedSize > ARCHIVE_LIMITS.maxEntryUncompressedBytes) {
                throw archiveError(`entry is too large: ${normalizedName}`);
            }
            archiveExpandedBytes += entry.uncompressedSize;
            state.totalExpandedBytes += entry.uncompressedSize;
            if (archiveExpandedBytes > ARCHIVE_LIMITS.maxArchiveUncompressedBytes) {
                throw archiveError('archive uncompressed size exceeded');
            }
            if (state.totalExpandedBytes > ARCHIVE_LIMITS.maxTotalExpandedBytes) {
                throw archiveError('total nested expansion budget exceeded');
            }
            if (entry.uncompressedSize > 1024 * 1024) {
                if (entry.compressedSize <= 0)
                    throw archiveError(`invalid compressed size: ${normalizedName}`);
                const ratio = entry.uncompressedSize / entry.compressedSize;
                if (ratio > ARCHIVE_LIMITS.maxCompressionRatio) {
                    throw archiveError(`compression ratio exceeded: ${normalizedName}`);
                }
            }
            if (!entry.fileName.endsWith('/') && isNestedArchive(normalizedName)) {
                if (depth >= ARCHIVE_LIMITS.maxNestingDepth)
                    throw archiveError('nested archive depth exceeded');
                if (entry.uncompressedSize > ARCHIVE_LIMITS.maxNestedArchiveBytes) {
                    throw archiveError(`nested archive is too large: ${normalizedName}`);
                }
                const stream = await zipFile.openReadStreamPromise(entry);
                const nestedBuffer = await readStreamWithLimit(stream, ARCHIVE_LIMITS.maxNestedArchiveBytes);
                state.nestedArchiveCount += 1;
                await inspectLevel(nestedBuffer, depth + 1, identity, state);
            }
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith('Unsafe archive:'))
            throw error;
        throw archiveError(error instanceof Error ? error.message : 'archive inspection failed');
    }
    finally {
        zipFile.close();
    }
}
export async function inspectArchiveBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 22)
        throw archiveError('file is not a valid ZIP archive');
    const state = {
        entryCount: 0,
        totalExpandedBytes: 0,
        nestedArchiveCount: 0,
        maxDepth: 0,
        seenPaths: new Set(),
    };
    await inspectLevel(buffer, 0, 'root', state);
    return {
        entryCount: state.entryCount,
        totalExpandedBytes: state.totalExpandedBytes,
        nestedArchiveCount: state.nestedArchiveCount,
        maxDepth: state.maxDepth,
    };
}
//# sourceMappingURL=archiveInspection.js.map