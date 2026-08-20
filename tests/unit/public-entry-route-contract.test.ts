import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('public entry route contract', () => {
  it('routes the empty server list action to the registered editor page', () => {
    const page = read('qianfu-liandeng/src/pages/ServerList.tsx');
    const app = read('qianfu-liandeng/src/App.tsx');

    expect(page).toContain('<Link to="/editor"');
    expect(page).not.toContain('to="/dashboard/servers/new"');
    expect(app).toContain('path="/editor"');
  });

  it('keeps the home callout readable and mail links secure by default', () => {
    const showcase = read('qianfu-liandeng/src/components/business/HomeShowcase.tsx');
    const mail = read('qianfu-liandeng/src/pages/admin/AdminMailConfig.tsx');

    expect(showcase).toContain('tracking-[-0.05em] text-white');
    expect(mail).not.toContain('http://mc-u.top');
    expect(mail).toContain("import.meta.env.VITE_APP_URL || 'https://mc-u.top'");
  });

  it('links both login consent documents', () => {
    const login = read('qianfu-liandeng/src/pages/Login.tsx');

    expect(login).toContain('to="/terms"');
    expect(login).toContain('to="/privacy"');
    expect(login).toContain("t('auth.form.agree_prefix')");
  });

  it('keeps public copy factual and avoids the old showcase filler', () => {
    const showcase = read('qianfu-liandeng/src/components/business/HomeShowcase.tsx');
    const translations = read('qianfu-liandeng/src/store/uiStore.ts');

    expect(showcase).toContain('账号里有哪些功能');
    expect(showcase).toContain('下面是个人控制台、服务器管理、个人主页和工单中心的实际页面截图。');
    expect(showcase).not.toContain('先看页面，再决定怎么使用');
    expect(showcase).not.toContain('从访问到完成操作');
    expect(translations).toContain('填写服务器版本、玩法、地址和介绍。审核通过后会进入公开列表。');
    expect(translations).not.toContain('成千上万名活跃玩家');
  });
});
