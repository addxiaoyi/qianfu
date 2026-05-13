import { toast } from '@/hooks/use-toast';
import { staticT } from '@/store/uiStore';
import { sanitizeUrl } from '@/utils/urlValidator';

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
const BACKEND_FALLBACKS = ['http://localhost:3000', 'http://localhost:3001'];

const getApiBase = () => import.meta.env.VITE_API_URL || DEFAULT_API_BASE;

const normalizePath = (url: string) => {
  if (url.startsWith('http')) return url;
  const apiBase = getApiBase();
  const base = url.startsWith('/api') ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  return base.startsWith('/api/v1') ? base : base.replace(/^\/api(\/|$)/, '/api/v1$1');
};

let csrfTokenPromise: Promise<string | null> | null = null;

async function getCsrfToken() {
  if (typeof window === 'undefined') return null;
  const cached = window.localStorage.getItem(CSRF_TOKEN_KEY);
  if (cached) return cached;
  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      const csrfPath = normalizePath('/csrf-token');
      const candidateUrls = [
        csrfPath,
        ...BACKEND_FALLBACKS.map((base) => `${base.replace(/\/$/, '')}${csrfPath.startsWith('/') ? '' : '/'}${csrfPath}`),
      ];

      for (const candidate of candidateUrls) {
        try {
          const res = await fetch(candidate, { credentials: 'include' });
          if (!res.ok) continue;
          const json = await res.json().catch(() => null);
          const token = json?.data?.csrfToken || json?.csrfToken || null;
          if (token) {
            window.localStorage.setItem(CSRF_TOKEN_KEY, token);
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
    window.localStorage.removeItem(CSRF_TOKEN_KEY);
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
    // SuperTokens works with cookies, so we don't need to manually inject auth headers
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

  try {
    const response = await fetch(requestUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
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
      if (response.status === 502) {
        message = '后端服务未就绪，请稍后再试';
      }
      if (response.status === 404) {
        message = `[NETWORK_ERR] Target endpoint not found (404). Please ensure the backend server is active and the API route is correct.`;
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
        toast({
          title: staticT('common.sys_hint'),
          description: message,
          variant: 'destructive',
        });
      }

      throw new ApiError(message, response.status, errorData);
    }

    if (response.status === 204) return {} as T;
    if (responseType === 'blob') return (await response.blob()) as any;
    if (responseType === 'text') return (await response.text()) as any;

    const result = await response.json();
    const sanitized = sanitizeResponseData(result);
    return sanitized.data !== undefined ? sanitized.data : sanitized;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      toast({
        title: staticT('common.net_timeout'),
        description: staticT('common.net_timeout_desc'),
        variant: 'destructive',
      });
      throw new Error('Timeout');
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
