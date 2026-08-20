import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerEditor.tsx'), 'utf8');
const mine = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/MyServers.tsx'), 'utf8');

describe('server lifecycle UI contract', () => {
  it('keeps the published address editable and sends it on update', () => {
    const addressField = editor.slice(editor.indexOf('aria-label="服务器地址"'), editor.indexOf('placeholder={formData.platform', editor.indexOf('aria-label="服务器地址"')));
    expect(addressField).not.toContain('disabled={!!serverId}');
    expect(editor).toContain('ip: values.ip');
  });

  it('exposes an owner delete action with a confirmation and refresh', () => {
    expect(mine).toContain("api.delete(");
    expect(mine).toContain("rustV2Path(`/servers/${serverId}`)");
    expect(mine).toContain('window.confirm');
    expect(mine).toContain("queryKey: ['my-servers']");
    expect(mine).toContain('删除服务器');
  });

  it('keeps Rust v2 discovery metadata in publish and edit flows', () => {
    expect(editor).toContain('category: String(values.tags ||');
    expect(editor).toContain(".filter(Boolean).join(',') || undefined");
    expect(editor).toContain('version: values.version.trim()');
    expect(editor).toContain("tags: useRustV2 ? data.category || ''");
    expect(editor).toContain("version: useRustV2 ? data.version || ''");
  });
});
