import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { registerCors } from '../../server/bootstrap/security';

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe('production CORS policy', () => {
  it('does not grant credentialed CORS access to local development origins', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.PREVIEW_URL;

    const app = express();
    registerCors(app);
    app.get('/probe', (_req, res) => res.sendStatus(204));

    const response = await request(app)
      .get('/probe')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
