import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/services/redisService', () => ({
  redisService: {
    get: vi.fn().mockResolvedValue(null),
    incr: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

import { antiCrawler } from '../../server/middleware/antiCrawler';

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(antiCrawler);
  app.all('*path', (_req, res) => res.json({ ok: true }));
  return app;
}

const externalRequest = (app: ReturnType<typeof createApp>, method: 'get' | 'post', path: string) =>
  request(app)[method](path)
    .set('X-Forwarded-For', '203.0.113.10')
    .set('User-Agent', 'curl/8.10.1');

describe('anti-crawler public route policy', () => {
  it('allows the public current-announcement GET without browser-only headers', async () => {
    const response = await externalRequest(createApp(), 'get', '/api/v1/announcements/current');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('allows QR image requests without browser-only headers', async () => {
    const response = await externalRequest(createApp(), 'get', '/api/v1/assets/qr?data_b64=SGVsbG8');

    expect(response.status).toBe(200);
  });

  it('does not bypass protection for non-GET announcement requests', async () => {
    const response = await externalRequest(createApp(), 'post', '/api/v1/announcements/current');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ILLEGAL_REQUEST_BLOCKED');
  });

  it('keeps administrator announcement routes protected', async () => {
    const response = await externalRequest(createApp(), 'get', '/api/v1/admin/announcements');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ILLEGAL_REQUEST_BLOCKED');
  });

  it('allows PayPal webhooks without browser-only headers', async () => {
    const response = await externalRequest(createApp(), 'post', '/api/v1/payment/paypal/webhook');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
