import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('public pay-domain probe contract', () => {
  it('probes the retained payment hostname by default', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const diagnoseScript = read('scripts/diagnose-public-prod.ts');
    const verifyScript = read('scripts/windows/verify-public-production.ps1');

    expect(packageJson.scripts['prod:healthcheck:public']).not.toContain('PAY_DOMAIN_HOST=pay.star-web.top');
    expect(diagnoseScript).toContain("process.env.PAY_DOMAIN_HOST || 'pay.star-web.top'");
    expect(diagnoseScript).toContain("if (!payHost)");
    expect(verifyScript).toContain('else { "pay.star-web.top" }');
    expect(verifyScript).toContain('if (-not $SkipPayDomain -and $PayHost)');
    expect(verifyScript).toContain('if ($failed.Count -gt 0)');
    expect(verifyScript).not.toContain('if ($failed.Count -gt 0 -and -not $ReportOnly)');
  });

  it('closes the retained pay hostname without proxying payment services', () => {
    const template = read('deploy/nginx/pay.star-web.top.conf.example');
    const healthcheck = read('scripts/linux/qianfu-prod-healthcheck.sh');
    const repair = read('scripts/linux/repair-prod-edge.sh');
    const setup = read('scripts/linux/setup-pay-domain.sh');

    expect(template).toContain('return 410 "PERSONAL_FILING_DISABLED\\n";');
    expect(template).not.toContain('qianfu-pay-gateway');
    expect(template).not.toContain('proxy_pass');
    expect(template).not.toContain('qianfu_pay_api');
    expect(template).not.toContain('qianfu_pay_xpay');

    expect(healthcheck).toContain('PERSONAL_FILING_DISABLED');
    expect(healthcheck).toContain('410');
    expect(healthcheck).not.toContain('qianfu-pay-gateway');

    expect(repair).toContain('PERSONAL_FILING_DISABLED');
    expect(repair).toContain('410');
    expect(repair).not.toContain('qianfu-pay-gateway');

    expect(setup).toContain('PERSONAL_FILING_DISABLED');
    expect(setup).toContain('410');
    expect(setup).not.toContain('qianfu-pay-gateway');
    expect(setup).not.toContain('127.0.0.1:8889');
  });

  it('diagnoses the retained pay hostname as intentionally closed', () => {
    const diagnose = read('scripts/diagnose-public-prod.ts');
    const oneClick = read('scripts/linux/deploy-bt-oneclick.sh');
    const browserAudit = read('scripts/public-live-browser-audit.cjs');
    const linuxDiagnose = read('scripts/linux/diagnose-prod-502.sh');
    const windowsDiagnose = read('scripts/windows/diagnose-prod-502.ps1');

    expect(diagnose).toContain('personal_filing_closed');
    expect(diagnose).toContain('PERSONAL_FILING_DISABLED');
    expect(diagnose).not.toContain('qianfu-pay-gateway');

    expect(oneClick).toContain('PERSONAL_FILING_DISABLED');
    expect(oneClick).toContain('personal_filing_closed');
    expect(oneClick).not.toContain('qianfu-pay-gateway');

    expect(browserAudit).toContain("expectText: 'PERSONAL_FILING_DISABLED'");
    expect(browserAudit).toContain("expectExactBody: 'PERSONAL_FILING_DISABLED'");
    expect(browserAudit).not.toContain('qianfu-pay-gateway');

    expect(linuxDiagnose).toContain('personal_filing_disabled');
    expect(linuxDiagnose).toContain('PERSONAL_FILING_DISABLED');
    expect(linuxDiagnose).not.toContain('qianfu-pay-gateway');

    expect(windowsDiagnose).toContain('personal_filing_disabled');
    expect(windowsDiagnose).toContain('PERSONAL_FILING_DISABLED');
    expect(windowsDiagnose).not.toContain('qianfu-pay-gateway');

  });
});
