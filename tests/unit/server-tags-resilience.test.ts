import { describe, expect, it } from 'vitest';

import { parseListField } from '../../qianfu-liandeng/src/utils/serverView';
import { normalizeServerRecord, normalizeServerRecords } from '../../server/utils/serverResponse';

describe('server tag resilience', () => {
  it('extracts labels from AI/object tag payloads', () => {
    expect(parseListField([{ label: '生存' }, { name: '小游戏' }])).toEqual(['生存', '小游戏']);
    expect(parseListField({ label: '生存' })).toEqual(['生存']);
  });

  it('deduplicates and caps noisy AI labels', () => {
    expect(parseListField(Array.from({ length: 14 }, (_, index) => ({ label: `标签${index}` })).concat({ label: '标签0' }))).toHaveLength(12);
  });

  it('falls back to plain text labels when the field is not JSON', () => {
    expect(parseListField('生存 PVP')).toEqual(['生存', 'PVP']);
  });

  it('keeps the public list contract typed at the request boundary', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('qianfu-liandeng/src/pages/ServerList.tsx', 'utf8'));
    expect(source).toContain("request<ServerListItem[]>('/public/servers'");
    expect(source).not.toContain("request<any[]>('/public/servers'");
  });

  it('normalizes historical JSON tag strings in every server response shape', () => {
    const server = normalizeServerRecord({ id: 5, tags: '["生存",{"label":"PVP"}]' });

    expect(server.tags).toEqual(['生存', 'PVP']);
    expect(normalizeServerRecords([{ id: 5, tags: '生存 PVP' }])[0].tags).toEqual(['生存', 'PVP']);
  });
});
