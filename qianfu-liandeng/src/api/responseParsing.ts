export const NON_JSON_RESPONSE_MESSAGE = '服务器返回了非 JSON 响应，请刷新页面后重试';

export class NonJsonResponseError extends Error {
  readonly code = 'NON_JSON_RESPONSE';

  constructor() {
    super(NON_JSON_RESPONSE_MESSAGE);
    this.name = 'NonJsonResponseError';
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NonJsonResponseError();
  }
}
