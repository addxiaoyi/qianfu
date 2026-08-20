import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('marketplace route security policy', () => {
  it('fails closed for the retired marketplace API namespace', () => {
    const routes = read('server/routes/index.ts');
    const closure = read('server/middleware/commercialFeatureClosure.ts');
    const disabled = read('server/middleware/personalFilingDisabled.ts');

    expect(routes).toContain('commercialFeatureClosure');
    expect(closure).toContain("'/api/marketplace'");
    expect(closure).toContain("'/api/v1/marketplace'");
    expect(closure).toContain("'/api/qianfu'");
    expect(disabled).toContain('PERSONAL_FILING_DISABLED');
  });

  it('does not expose a public order collection or payment-backed marketplace entry', () => {
    const routes = read('server/core/controller/QianFuController.ts');
    const app = read('qianfu-liandeng/src/App.tsx');
    const home = read('qianfu-liandeng/src/pages/MobileHome.tsx');

    expect(routes).not.toContain("router.get('/marketplace/orders',");
    expect(app).toMatch(/path="\/marketplace\/\*" element={<CommercialFeatureDisabled \/>} \/>/);
    expect(home).not.toMatch(/\/marketplace\/|商城/);
  });
});
