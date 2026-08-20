import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/Dashboard.tsx'), 'utf8');

describe('dashboard nested route auth hydration', () => {
  it('keeps a protected route loading while the session is being restored', () => {
    expect(dashboard).toContain('authLoading');
    expect(dashboard).toContain('authLoading ? <LoadingFallback />');
  });

  it('redirects only after session hydration confirms an anonymous visitor', () => {
    expect(dashboard).toContain('protectDashboardRoute');
    expect(dashboard).toContain('isGuest ? <Navigate to="/dashboard" replace />');
  });

  it('renders the protected page after an authenticated session is ready', () => {
    expect(dashboard).toContain('protectDashboardRoute(<MyServers />)');
  });
});
