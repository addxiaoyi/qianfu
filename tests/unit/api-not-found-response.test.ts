import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { registerStaticAndFallback } from '../../server/bootstrap/proxyAndStatic';

function createApp() {
  const app = express();
  registerStaticAndFallback(app);
  return app;
}

describe('API not-found responses', () => {
  it('returns JSON for an unknown versioned API route', async () => {
    const response = await request(createApp()).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns JSON for an unknown API write route', async () => {
    const response = await request(createApp())
      .post('/api/v1/does-not-exist')
      .send({ value: true });

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
