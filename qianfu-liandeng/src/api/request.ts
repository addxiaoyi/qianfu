import { notifyError } from '../lib/error-notification';
import { staticT } from '@/store/uiStore';
import { sanitizeUrl } from '@/utils/urlValidator';
import { resolveHttpErrorMessage } from './errorMessage';
import { NonJsonResponseError, readJsonResponse } from './responseParsing';

const URL_FIELDS = new Set([
  'url', 'imageUrl', 'coverUrl', 'avatarUrl', 'bannerUrl',
  'iconUrl', 'logoUrl', 'thumbnailUrl', 'image', 'imgUrl',
  'src', 'link', 'redirectUrl', 'redirectURL', 'returnUrl',
  'image_url', 'cover_image', 'profile_image', 'avatar',
]);

function isUrlField(key: string): boolean {
  const lower = key.toLowerCase();
  if (URL_FIELDS.has(lower)) return true;
  if (lower.endsWith('Url') || lower.endsWith('URL') || lower.endsWith('url')) return true;
  return false;
}

function sanitizeResponseData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(sanitizeResponseData);

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isUrlField(key) && typeof value === 'string') {
        sanitized[key] = sanitizeUrl(value);
      } else {
        sanitized[key] = sanitizeResponseData(value);
      }
    }
    return sanitized;
  }

  return data;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  useAuth?: boolean;
  params?: Record<string, any>;
  responseType?: 'json' | 'blob' | 'text';
  skipCsrf?: boolean;
}

function combineAbortSignals(timeoutSignal: AbortSignal, callerSignal?: AbortSignal): AbortSignal {
  if (!callerSignal) return timeoutSignal;
  const mergedController = new AbortController();
  const abort = () => mergedController.abort();
  if (timeoutSignal.aborted || callerSignal.aborted) {
    mergedController.abort();
    return mergedController.signal;
  }

  timeoutSignal.addEventListener('abort', abort, { once: true });
  callerSignal.addEventListener('abort', abort, { once: true });
  return mergedController.signal;
}

export class ApiError extends Error {
  status: number;
  data: any;
  code?: string;
  requestId?: string;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = data?.error?.code;
    this.requestId = data?.error?.requestId || data?.requestId;
  }
}

const getErrorCode = (data: any) => data?.error?.code || data?.code;

const isSessionExpired = (status: number, code?: string) =>
  status === 401 || code === 'SESSION_EXPIRED';

const isPermissionDenied = (status: number, code?: string) =>
  status === 403 || code === 'PERMISSION_DENIED';

const isValidationError = (status: number, code?: string) =>
  status === 400 || code === 'VALIDATION_ERROR';

const isRateLimited = (status: number, code?: string) =>
  status === 429 || code === 'RATE_LIMIT_EXCEEDED' || code === 'LIMIT_EXCEEDED';

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_API_BASE = '/api';
const CSRF_TOKEN_KEY = 'qf_csrf_token';
const LOCAL_AUTH_TOKEN_KEY = 'qf_local_auth_token';
const BACKEND_FALLBACKS = ['http://localhost:3000', 'http://localhost:3001'];
let localAuthTokenMemory: string | null = null;

const getApiBase = () => import.meta.env.VITE_API_URL || DEFAULT_API_BASE;
const isRustV2Enabled = () => String(import.meta.env.VITE_API_V2 || '').toLowerCase() === 'true';
const rustV2Path = (value: string) => {
  if (!isRustV2Enabled()) return value;
  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : value.slice(suffixIndex);
  const path = pathname.replace(/^\/api\/v1/, '');
  // Do not infer compatibility from a matching resource name. The v1 browser
  // flows currently use different session and server payload contracts.
  const isV2DnsCatalog = /^\/dns\/suffixes\/?$/.test(path);

  return isV2DnsCatalog ? `/api/v2${path}${suffix}` : value;
};

export const normalizePath = (url: string) => {
  if (url.startsWith('http')) return url;
  const apiBase = getApiBase();
  const base = url.startsWith('/api') ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  if (/^\/api\/v\d+(\/|$)/.test(base)) {
    return rustV2Path(base);
  }
  const normalized = base.replace(/^\/api(\/|$)/, '/api/v1$1');
  return rustV2Path(normalized);
};

let csrfTokenPromise: Promise<string | null> | null = null;

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getCsrfStorage() {
  return getSessionStorage() || getLocalStorage();
}

function readCookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getCsrfToken() {
  if (typeof window === 'undefined') return null;
  const cookieToken = readCookieValue('csrf_token');
  if (cookieToken) {
    getCsrfStorage()?.setItem(CSRF_TOKEN_KEY, cookieToken);
    return cookieToken;
  }
  const cached = getCsrfStorage()?.getItem(CSRF_TOKEN_KEY);
  if (cached) return cached;
  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      const csrfPath = normalizePath('/csrf-token');
      const candidateUrls = [
        csrfPath,
        ...(import.meta.env.DEV
          ? BACKEND_FALLBACKS.map((base) => `${base.replace(/\/$/, '')}${csrfPath.startsWith('/') ? '' : '/'}${csrfPath}`)
          : []),
      ];

      for (const candidate of candidateUrls) {
        try {
          const res = await fetch(candidate, { credentials: 'include' });
          if (!res.ok) continue;
          const json = await res.json().catch(() => null);
          const token = json?.data?.csrfToken || json?.csrfToken || null;
          if (token) {
            getCsrfStorage()?.setItem(CSRF_TOKEN_KEY, token);
            return token;
          }
        } catch {
          continue;
        }
      }

      return null;
    })().finally(() => {
      csrfTokenPromise = null;
    });
  }
  return csrfTokenPromise;
}

export async function invalidateCsrfToken() {
  if (typeof window !== 'undefined') {
    getSessionStorage()?.removeItem(CSRF_TOKEN_KEY);
    getLocalStorage()?.removeItem(CSRF_TOKEN_KEY);
  }
}

export function getLocalAuthToken() {
  if (typeof window !== 'undefined') {
    getSessionStorage()?.removeItem(LOCAL_AUTH_TOKEN_KEY);
    getLocalStorage()?.removeItem(LOCAL_AUTH_TOKEN_KEY);
  }
  return localAuthTokenMemory;
}

export function setLocalAuthToken(token: string | null) {
  localAuthTokenMemory = token;
  if (typeof window !== 'undefined') {
    getSessionStorage()?.removeItem(LOCAL_AUTH_TOKEN_KEY);
    getLocalStorage()?.removeItem(LOCAL_AUTH_TOKEN_KEY);
  }
}

export function getFrontendApiBase() {
  return getApiBase();
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    useAuth = true,
    params,
    responseType = 'json',
    skipCsrf = false,
    ...fetchOptions
  } = options;

  let requestUrl = normalizePath(url);

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(fetchOptions.headers || {});
  if (useAuth && !headers.has('Authorization')) {
    const localAuthToken = getLocalAuthToken();
    if (localAuthToken) {
      headers.set('Authorization', `Bearer ${localAuthToken}`);
    }
  }

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !skipCsrf;
  if (needsCsrf && !headers.has('x-csrf-token')) {
    const token = await getCsrfToken();
    if (token) {
      headers.set('x-csrf-token', token);
    }
  }

  if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const signal = combineAbortSignals(controller.signal, fetchOptions.signal);

  try {
    if (typeof window !== 'undefined') {
      const parsedRequestUrl = new URL(requestUrl, window.location.origin);
      const allowedOrigins = new Set([window.location.origin]);
      const apiBase = getApiBase();
      if (/^https?:\/\//i.test(apiBase)) {
        allowedOrigins.add(new URL(apiBase).origin);
      }
      if (!allowedOrigins.has(parsedRequestUrl.origin)) {
        throw new ApiError('Blocked cross-origin API request', 400, {
          error: { code: 'UNTRUSTED_API_ORIGIN' },
        });
      }
    }

    const response = await fetch(requestUrl, {
      ...fetchOptions,
      headers,
      signal,
      credentials: 'include',
    });

    clearTimeout(id);

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` };
      }

      const code = getErrorCode(errorData);
      let message = errorData?.error?.message || errorData?.message || staticT('common.error');
      message = resolveHttpErrorMessage(response.status, code, message);
      if (response.status === 404) {
        message = errorData?.error?.message || '请求的内容不存在或已下架';
      }

      if (isSessionExpired(response.status, code)) {
        await invalidateCsrfToken();
      }

      if (isValidationError(response.status, code) && Array.isArray(errorData?.error?.details)) {
        message = errorData.error.details.map((item: any) => item?.message || item?.msg || item).filter(Boolean).join('；') || message;
      }

      if (isRateLimited(response.status, code)) {
        message = errorData?.error?.message || '请求过于频繁，请稍后再试';
      }

      if (isPermissionDenied(response.status, code)) {
        message = errorData?.error?.message || '暂无权限访问此资源';
      }

      if (!(isSessionExpired(response.status, code))) {
        notifyError(message, {
          title: staticT('common.sys_hint'),
          variant: 'destructive',
        });
      }

      throw new ApiError(message, response.status, errorData);
    }

    if (response.status === 204) return {} as T;
    if (responseType === 'blob') return (await response.blob()) as unknown;
    if (responseType === 'text') return (await response.text()) as unknown;

    let result: any;
    try {
      result = await readJsonResponse<any>(response);
    } catch (error) {
      if (error instanceof NonJsonResponseError) {
        throw new ApiError(error.message, response.status, {
          error: { code: error.code },
        });
      }
      throw error;
    }
    const sanitized = sanitizeResponseData(result);
    return sanitized.data !== undefined ? sanitized.data : sanitized;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      const timeoutMessage = staticT('common.net_timeout_desc');
      notifyError(timeoutMessage, {
        title: staticT('common.net_timeout'),
        variant: 'destructive',
      });
      throw new Error(timeoutMessage);
    }
    if (error instanceof ApiError && isSessionExpired(error.status, error.code)) {
      await invalidateCsrfToken();
    }
    throw error;
  }
}

export const api = {
  get: <T = any>(url: string, params?: Record<string, any>, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'GET', params }),
  post: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'POST', body }),
  put: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'PUT', body }),
  patch: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'PATCH', body }),
  delete: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),
  invalidateCsrfToken,
};
