import type { RequestOptions } from './request';

export const isRustV2Enabled = () => String(import.meta.env.VITE_API_V2 || '').toLowerCase() === 'true';

export const rustV2Path = (path: string) => `/api/v2${path}`;

// Rust v2 validates state-changing browser requests by Origin. It deliberately
// does not accept the legacy v1 CSRF token endpoint or cookie format.
export const rustV2RequestOptions: RequestOptions = {
  skipCsrf: true,
};
