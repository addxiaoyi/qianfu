import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as callbackPolicy from '../../server/core/task/callbackOutboundPolicy';
import { registerStaticAndFallback } from '../../server/bootstrap/proxyAndStatic';
import { port5555ErrorHandler } from '../../server/middleware/port5555ErrorHandler';
import assetsRoutes from '../../server/routes/assets';
import { sanitize } from '../../server/services/sanitize';
import { registerHttpsRedirect } from '../../server/bootstrap/httpGuards';

describe('security hardening', () => {
  describe('CMS HTML sanitizer', () => {
    it('strips inline styles and event handlers from stored HTML', () => {
      const html = sanitize('<p style="color:red" onclick="alert(1)">hello</p>');
      expect(html).toBe('<p>hello</p>');
    });

    it('adds safe attributes to external links and embedded iframes', () => {
      const html = sanitize([
        '<a href="https://example.com/docs">docs</a>',
        '<iframe src="https://www.youtube.com/embed/abc" title="video"></iframe>',
      ].join(''));

      expect(html).toContain('rel="nofollow noopener noreferrer"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
      expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    });
  });

  describe('outbound callback policy', () => {
    it('rejects local and internal callback hostnames', () => {
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('http://localhost:3000/hook')).toThrow();
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('http://127.0.0.1:3000/hook')).toThrow();
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('http://metadata.google.internal/hook')).toThrow();
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('http://service.internal/hook')).toThrow();
    });

    it('rejects callback URLs with embedded credentials', () => {
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('https://user:pass@example.com/hook')).toThrow();
    });

    it('allows normal HTTPS callback URLs', () => {
      expect(() => callbackPolicy.assertSafeOutboundCallbackUrl('https://example.com/hook')).not.toThrow();
    });

    it('rejects callback hosts that resolve to an internal address', async () => {
      const resolveSafeUrl = (callbackPolicy as {
        assertSafeResolvedOutboundCallbackUrl?: (
          url: string,
          resolveAddresses: (hostname: string) => Promise<string[]>,
        ) => Promise<void>;
      }).assertSafeResolvedOutboundCallbackUrl;

      expect(resolveSafeUrl).toBeTypeOf('function');
      if (!resolveSafeUrl) return;

      await expect(resolveSafeUrl(
        'https://webhook.example/hook',
        async () => ['10.0.0.9'],
      )).rejects.toThrow('internal address');
      await expect(resolveSafeUrl(
        'https://webhook.example/hook',
        async () => ['8.8.8.8'],
      )).resolves.toBeUndefined();
    });

    it('does not follow redirect responses from callback endpoints', () => {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), 'server/core/task/CallbackQueue.ts'),
        'utf8',
      );

      expect(source).toContain("redirect: 'manual'");
    });
  });

  describe('uploaded static assets', () => {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const testFile = path.join(uploadsDir, 'security-hardening-test.txt');

    beforeAll(() => {
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(testFile, 'plain text asset', 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('serves non-image uploads as attachments with nosniff', async () => {
      const app = express();
      registerStaticAndFallback(app);

      const response = await request(app).get('/uploads/security-hardening-test.txt');
      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    });
  });

  describe('port 5555 HTML errors', () => {
    it('escapes attacker-controlled error messages in HTML responses', async () => {
      const app = express();
      app.get('/api/port5555/security-test', () => {
        throw new Error('<script>alert(1)</script>');
      });
      app.use(port5555ErrorHandler);

      const response = await request(app)
        .get('/api/port5555/security-test')
        .set('Accept', 'text/html');

      expect(response.status).toBe(500);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['content-security-policy']).toContain("script-src 'none'");
      expect(response.text).not.toContain('<script>alert(1)</script>');
      expect(response.text).not.toContain('<script>');
      expect(response.text).not.toContain('window.location');
      expect(response.text).toContain('Internal server error, please try again later');
    });
  });

  describe('API error envelopes', () => {
    it('returns JSON for blocked HTTPS hosts', async () => {
      const app = express();
      const previousForceHttps = process.env.FORCE_HTTPS;
      process.env.FORCE_HTTPS = 'true';
      registerHttpsRedirect(app);

      try {
        const response = await request(app)
          .get('/api/security-test')
          .set('Host', 'attacker.invalid');

        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toMatchObject({
          success: false,
          error: { code: 'INVALID_HOST' },
        });
      } finally {
        if (previousForceHttps === undefined) delete process.env.FORCE_HTTPS;
        else process.env.FORCE_HTTPS = previousForceHttps;
      }
    });
  });

  describe('asset helpers', () => {
    it('generates payment QR codes locally without a third-party QR service', async () => {
      const app = express();
      app.use('/api/v1/assets', assetsRoutes);

      const response = await request(app).get('/api/v1/assets/qr').query({
        data: 'https://mc-u.top/#/payment/success?order=test',
        size: '160',
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(response.body.length).toBeGreaterThan(100);
    });

    it('accepts encoded payment URLs without the XSS query scanner rejecting them', async () => {
      const app = express();
      app.use('/api/v1/assets', assetsRoutes);
      const data = Buffer.from('https://pay.mzfpay.com/xpay/epay/submit.php?pid=12082&type=wxpay&money=1.00&sign=test').toString('base64url');

      const response = await request(app).get('/api/v1/assets/qr').query({ data_b64: data });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
    });

    it('rejects oversized QR payloads', async () => {
      const app = express();
      app.use('/api/v1/assets', assetsRoutes);

      const response = await request(app).get('/api/v1/assets/qr').query({
        data: 'x'.repeat(2050),
      });

      expect(response.status).toBe(400);
    });
  });
});
