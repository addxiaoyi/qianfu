import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerEditor.tsx'),
  'utf8',
);
const serverView = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/utils/serverView.ts'),
  'utf8',
);

describe('server editor listing plan control', () => {
  it('locks new listings to a free long-term plan without native controls', () => {
    expect(editor).toContain("listingPlan: 'free-monthly'");
    expect(editor).toContain('免费展示');
    expect(editor).toContain('不设付费上架、钱包扣款或推广返利');
    expect(editor).not.toMatch(/<select[\s\S]{0,200}aria-label="服务器发布套餐"/);
    expect(editor).not.toContain('CustomSelect');
    expect(serverView).toContain("return plan === 'free-monthly' || !plan ? '免费入驻' : '历史数据';");
    expect(serverView).toContain('免费展示，长期有效');
    expect(editor).not.toContain('推广入驻');
    expect(editor).not.toContain('免费展示 30 天');
    expect(editor).not.toContain('开启相应展示周期');
  });
});
