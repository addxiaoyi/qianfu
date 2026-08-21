const DEFAULT_API_BASE = '/api';

export const resolveBackendHealthUrl = (
  apiBase: string | undefined,
  currentOrigin: string,
  rustV2 = false,
): string => {
  const normalizedBase = apiBase?.trim() || DEFAULT_API_BASE;
  const originUrl = new URL(currentOrigin);
  const apiUrl = new URL(normalizedBase, `${originUrl.origin}/`);
  const apiPath = apiUrl.pathname
    .replace(/\/+$/, '')
    .replace(/\/v1$/i, '') || DEFAULT_API_BASE;

  apiUrl.pathname = rustV2
    ? `${apiPath}/v2/ready`.replace(/\/{2,}/g, '/')
    : `${apiPath}/health`.replace(/\/{2,}/g, '/');
  apiUrl.search = '';
  apiUrl.hash = '';

  return apiUrl.origin === originUrl.origin
    ? apiUrl.pathname
    : apiUrl.toString();
};
