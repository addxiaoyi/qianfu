import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('mobile server detail resilience', () => {
  it('distinguishes missing, forbidden, and retryable server detail failures', () => {
    const detail = read('qianfu-liandeng', 'src', 'components', 'mobile', 'MobileServerDetail.tsx');

    expect(detail).toContain("import { ApiError, api } from '../../api/request'");
    expect(detail).toContain('error instanceof ApiError && error.status === 404');
    expect(detail).toContain('error instanceof ApiError && error.status === 403');
    expect(detail).toContain('[403, 404].includes(queryError.status)');
    expect(detail).toContain('failureCount < 1');
    expect(detail).toContain('const isValidServerId = isServerRouteId(id)');
    expect(detail).toContain('enabled: isValidServerId');
    expect(detail).toContain('服务器链接格式无效');
    expect(detail).toContain('服务器不存在');
    expect(detail).toContain('暂时无法查看该服务器');
    expect(detail).toContain('aria-label="重新加载服务器详情"');
    expect(detail).toContain('role="alert"');
  });

  it('does not start dependent mobile requests before the main server exists', () => {
    const detail = read('qianfu-liandeng', 'src', 'components', 'mobile', 'MobileServerDetail.tsx');

    expect(detail).toContain('enabled: Boolean(id && server && isAuthenticated && !useRustV2)');
    expect(detail).toContain('enabled: Boolean(id && server && isAuthenticated && !useRustV2)');
    expect(detail).toContain('enabled: !!similarCategory');
    expect(detail).toContain('aria-pressed={activeTab === tab.id}');
    expect(detail).toContain('aria-label="服务器详情分区"');
    expect(detail).toContain('safe-area-inset-bottom');
  });

  it('supports a configurable production HTTPS tunnel and always closes it', () => {
    const tunnel = read('scripts', 'production-https-tunnel.py');
    const runner = read('scripts', 'run-public-browser-audit-via-tunnel.cjs');
    const audit = read('scripts', 'public-live-browser-audit.cjs');
    const packageJson = JSON.parse(read('package.json'));

    expect(tunnel).toContain('QIANFU_TUNNEL_JUMP_HOST');
    expect(tunnel).toContain('QIANFU_TUNNEL_TARGET_KEY');
    expect(tunnel).toContain('paramiko.RejectPolicy()');
    expect(tunnel).toContain("target_transport.open_channel(");
    expect(tunnel).toContain("'direct-tcpip'");
    expect(tunnel).toContain('except (EOFError, OSError)');
    expect(tunnel).toContain("LOCAL_HOST = os.environ.get('QIANFU_TUNNEL_LOCAL_HOST', '127.0.0.1')");
    expect(runner).toContain('waitForTunnelReady');
    expect(runner).toContain('waitForPortClosed');
    expect(runner).toContain("spawnSync('taskkill'");
    expect(runner).toContain('tunnel_closed=');
    expect(audit).toContain('--executable-path');
    expect(audit).toContain('--host-resolver-rules');
    expect(audit).toContain('/api/v1/session-profile');
    expect(audit).toContain('hasAllowedAuthProbe');
    expect(audit).toContain('launchOptions.executablePath');
    expect(packageJson.scripts['prod:audit:browser:public:tunnel']).toBe(
      'node scripts/run-public-browser-audit-via-tunnel.cjs',
    );
  });
});
