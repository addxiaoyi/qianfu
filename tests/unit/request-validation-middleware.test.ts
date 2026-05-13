import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery, validateRequest } from '../../server/middleware/requestValidation';

const testErrorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
  res.status((err as any).statusCode || 500).json({
    success: false,
    error: {
      code: (err as any).errorCode || 'INTERNAL_ERROR',
      details: (err as any).details ?? null,
    },
  });
};

describe('requestValidation middleware', () => {
  it('should reject whitespace-only required query after normalization', async () => {
    const app = express();
    app.get(
      '/search',
      validateQuery(
        z.object({
          search: z.string().min(1),
        }),
      ),
      (req, res) => {
        res.status(200).json({ search: (req.query as any).search });
      },
    );
    app.use(testErrorHandler);

    const response = await request(app).get('/search?search=%20%20%20');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details?.[0]?.source).toBe('query');
  });

  it('should return VALIDATION_ERROR when required body field is missing after normalization', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/profile',
      validateBody(
        z.object({
          name: z.string().min(1),
        }),
      ),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    app.use(testErrorHandler);

    const response = await request(app).post('/profile').send({ name: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details?.[0]?.source).toBe('body');
  });

  it('should validate path params', async () => {
    const app = express();
    app.get(
      '/tickets/:id',
      validateParams(
        z.object({
          id: z.string().regex(/^\d+$/),
        }),
      ),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    app.use(testErrorHandler);

    const response = await request(app).get('/tickets/abc');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details?.[0]?.source).toBe('params');
  });

  it('should apply schema defaults when assignParsedData is enabled for body', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/history',
      validateRequest({
        body: {
          schema: z.object({
            range: z.enum(['24h', '7d']).default('24h'),
          }),
          options: { assignParsedData: true },
        },
      }),
      (req, res) => {
        res.status(200).json({ range: (req.body as any).range });
      },
    );
    app.use(testErrorHandler);

    const response = await request(app).post('/history').send({});
    expect(response.status).toBe(200);
    expect(response.body.range).toBe('24h');
  });
});
