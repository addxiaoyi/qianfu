import path from 'node:path';

export type UploadEnvironment = Record<string, string | undefined>;

export function resolveUploadDirectory(
  env: UploadEnvironment = process.env,
  cwd = process.cwd(),
): string {
  const configured = env.UPLOAD_DIR?.trim();
  return configured ? path.resolve(configured) : path.resolve(cwd, 'uploads');
}

export const UPLOADS_DIR = resolveUploadDirectory();
