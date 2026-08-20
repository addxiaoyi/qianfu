import path from 'node:path';
export function resolveUploadDirectory(env = process.env, cwd = process.cwd()) {
    const configured = env.UPLOAD_DIR?.trim();
    return configured ? path.resolve(configured) : path.resolve(cwd, 'uploads');
}
export const UPLOADS_DIR = resolveUploadDirectory();
//# sourceMappingURL=uploadStorage.js.map