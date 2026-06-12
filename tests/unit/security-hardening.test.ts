import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeOutboundCallbackUrl } from '../../server/core/task/callbackOutboundPolicy';
import { registerStaticAndFallback } from '../../server/bootstrap/proxyAndStatic';
import { port5555ErrorHandler } from '../../server/middleware/port5555ErrorHandler';
import assetsRoutes from '../../server/routes/assets';
import { sanitize } from '../../server/services/sanitize';

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
      expect(() => assertSafeOutboundCallbackUrl('http://localhost:3000/hook')).toThrow();
      expect(() => assertSafeOutboundCallbackUrl('http://127.0.0.1:3000/hook')).toThrow();
      expect(() => assertSafeOutboundCallbackUrl('http://metadata.google.internal/hook')).toThrow();
      expect(() => assertSafeOutboundCallbackUrl('http://service.internal/hook')).toThrow();
    });

    it('rejects callback URLs with embedded credentials', () => {
      expect(() => assertSafeOutboundCallbackUrl('https://user:pass@example.com/hook')).toThrow();
    });

    it('allows normal HTTPS callback URLs', () => {
      expect(() => assertSafeOutboundCallbackUrl('https://example.com/hook')).not.toThrow();
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
