import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('frontend delivery performance contract', () => {
  it('starts Web Vitals only after the application render and a load/idle boundary', () => {
    const main = read('qianfu-liandeng', 'src', 'main.tsx');
    const webVitals = read('qianfu-liandeng', 'src', 'lib', 'webVitals.ts');

    expect(main).toContain("import { scheduleWebVitals } from './lib/webVitals'");
    expect(main).not.toContain('void reportWebVitals()');
    expect(main.indexOf("createRoot(document.getElementById('root')!).render(")).toBeLessThan(
      main.indexOf('scheduleWebVitals()'),
    );
    expect(webVitals).toContain("window.addEventListener('load', scheduleAfterLoad, { once: true })");
    expect(webVitals).toContain('requestIdleCallback(start, { timeout: 5000 })');
    expect(webVitals).toContain('window.setTimeout(start, 2000)');
    expect(webVitals).toContain("await import('web-vitals')");
  });

  it('defines one cache policy per delivery class without duplicate asset headers', () => {
    const nginx = read('deploy', 'nginx', 'mc-u.top.conf.example');

    expect(nginx).not.toContain('expires 1y;');
    expect(nginx).toContain('location ^~ /assets/');
    expect(nginx).toContain('Cache-Control "public, max-age=31536000, immutable" always');
    expect(nginx).toContain('location ^~ /icons/');
    expect(nginx).toContain('location ^~ /fonts/');
    expect(nginx).toContain('font/woff2 woff2;');
    expect(nginx).toContain('font/ttf ttf;');
    expect(nginx).toContain('Cache-Control "public, max-age=604800, stale-while-revalidate=86400" always');
    expect(nginx).toContain('location = /index.html');
    expect(nginx).toContain('location = /manifest.json');
    expect(nginx).toContain('location = /sw.js');
    expect(nginx.match(/Cache-Control "no-cache, must-revalidate" always/g)).toHaveLength(3);
    expect(nginx).toContain('Cache-Control "no-store" always');
    expect(nginx.match(/qianfu-spa-security-headers\.conf/g)?.length).toBeGreaterThanOrEqual(8);
  });
});
