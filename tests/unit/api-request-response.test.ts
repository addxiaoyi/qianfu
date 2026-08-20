import { describe, expect, it } from 'vitest';
import { NonJsonResponseError, readJsonResponse } from '../../qianfu-liandeng/src/api/responseParsing';

describe('API response parsing', () => {
  it('reports a clear error when a successful API response is HTML', async () => {
    const response = new Response('<html><meta charset="utf-8">WAF error</html>', {
      status: 200,
      headers: { 'content-type': 'text/html;charset=utf-8' },
    });

    const error = await readJsonResponse(response).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(NonJsonResponseError);
    expect(error).toMatchObject({
      message: '服务器返回了非 JSON 响应，请刷新页面后重试',
      code: 'NON_JSON_RESPONSE',
    });
  });
});
