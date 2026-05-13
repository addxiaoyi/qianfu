import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  createDuplicateRequestGuard,
  createIdempotencyMiddleware,
} from '../../server/middleware/idempotency';
import { createRequestTimeoutMiddleware } from '../../server/middleware/requestTimeout';

vi.mock('../../server/services/redisService', () => {
  const cache = new Map<string, unknown>();
  const counter = new Map<string, number>();
  const locks = new Set<string>();

  return {
    redisService: {
      async get<T>(key: string): Promise<T | null> {
        return (cache.has(key) ? (cache.get(key) as T) : null);
      },
      async set(key: string, value: unknown): Promise<void> {
        cache.set(key, value);
      },
      async incr(key: string): Promise<number> {
        const next = (counter.get(key) || 0) + 1;
        counter.set(key, next);
        return next;
      },
      async acquireLock(key: string): Promise<boolean> {
        if (locks.has(key)) return false;
        locks.add(key);
        return true;
      },
      async releaseLock(key: string): Promise<void> {
        locks.delete(key);
      },
    },
  };
});

describe('robustness middlewares', () => {
  it('should block short-window duplicate write requests', async () => {
    const app = express();
    app.use(express.json());

    let executionCount = 0;
    app.post(
      '/submit',
      createDuplicateRequestGuard({ ttlSeconds: 3 }),
      (_req, res) => {
        executionCount += 1;
        return res.status(200).json({ ok: true, executionCount });
      },
    );

    const first = await request(app).post('/submit').send({ title: 'hello' });
    const second = await request(app).post('/submit').send({ title: 'hello' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body?.success).toBe(false);
    expect(second.body?.error?.code).toBe('DUPLICATE_REQUEST');
    expect(executionCount).toBe(1);
  });

  it('should replay cached response for same Idempotency-Key', async () => {
    const app = express();
    app.use(express.json());

    let executionCount = 0;
    app.post(
      '/create',
      createIdempotencyMiddleware({ ttlSeconds: 60 }),
      (_req, res) => {
        executionCount += 1;
        return res.status(201).json({ id: executionCount });
      },
    );

    const first = await request(app)
      .post('/create')
      .set('Idempotency-Key', 'test_key_12345')
      .send({ plan: 'monthly' });

    const second = await request(app)
      .post('/create')
      .set('Idempotency-Key', 'test_key_12345')
      .send({ plan: 'monthly' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['x-idempotent-replay']).toBe('1');
    expect(first.body).toEqual({ id: 1 });
    expect(second.body).toEqual({ id: 1 });
    expect(executionCount).toBe(1);
  });

  it('should return 504 when API request exceeds timeout threshold', async () => {
    const app = express();
    app.use('/api', createRequestTimeoutMiddleware({ timeoutMs: 30 }));

    app.get('/api/slow', async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!res.headersSent) {
        return res.status(200).json({ ok: true });
      }
      return undefined;
    });

    const response = await request(app).get('/api/slow');
    expect(response.status).toBe(504);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error?.code).toBe('GATEWAY_TIMEOUT');
  });

  it('should skip timeout enforcement for excluded paths', async () => {
    const app = express();
    app.use('/api', createRequestTimeoutMiddleware({ timeoutMs: 20, excludePaths: ['/api/health'] }));

    app.get('/api/health', async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
