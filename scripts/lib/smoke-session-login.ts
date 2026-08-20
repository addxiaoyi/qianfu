export type SmokeSession = {
  cookie: string;
};

export type SmokeResponse<T = unknown> = {
  status: number;
  ok: boolean;
  data: T | null;
  text: string;
};

export type SmokeRequest = (
  path: string,
  init?: RequestInit,
  session?: SmokeSession,
) => Promise<SmokeResponse<any>>;

function responseMessage(response: SmokeResponse): string {
  const payload = response.data as { error?: { message?: string }; message?: string } | null;
  return payload?.error?.message || payload?.message || response.text.slice(0, 240) || `HTTP ${response.status}`;
}

export async function loginWithCsrf(
  request: SmokeRequest,
  session: SmokeSession,
  identifier: string,
  password: string,
) {
  const csrf = await request('/api/v1/csrf-token', {}, session);
  if (!csrf.ok) {
    throw new Error(`CSRF token request failed for ${identifier}: ${responseMessage(csrf)}`);
  }

  const csrfPayload = csrf.data as { data?: { csrfToken?: string }; csrfToken?: string } | null;
  const csrfToken = csrfPayload?.data?.csrfToken || csrfPayload?.csrfToken || '';
  if (!csrfToken) {
    throw new Error(`CSRF token missing for ${identifier}`);
  }

  const login = await request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ identifier, password }),
    },
    session,
  );
  if (!login.ok) {
    throw new Error(`Login failed for ${identifier}: ${responseMessage(login)}`);
  }

  const loginPayload = login.data as { data?: { token?: string } } | null;
  const token = loginPayload?.data?.token || '';
  if (!token) {
    throw new Error(`Login token missing for ${identifier}`);
  }

  return { token, csrfToken, login, csrf };
}
