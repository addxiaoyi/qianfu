import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/pages/ServerEditor.tsx'), 'utf8');

describe('server editor draft hook contract', () => {
  it('seeds an empty draft from the latest watched form state', () => {
    expect(source).toContain('savedFingerprint.current = getServerEditorDraftFingerprint(latestFormData.current as ServerEditorDraft);');
  });

  it('builds the fingerprint from explicit form fields', () => {
    expect(source).toContain('name: formData.name');
    expect(source).toContain('listingPlan: formData.listingPlan');
  });

  it('waits for remote draft cleanup before leaving after submit', () => {
    expect(source).toContain('await draftPersistence.clear(draftKey);');
    expect(source).not.toContain('void draftPersistence.clear(draftKey);');
  });

  it('scopes remote draft requests to the active editor key', () => {
    expect(source).toContain('const remoteDraftUrl = (key: string) =>');
    expect(source).toContain('encodeURIComponent(key)');
    expect(source).toContain('load: async (key) =>');
    expect(source).toContain('api.get<{ draft?: ServerEditorDraft | null }>(remoteDraftUrl(key))');
    expect(source).toContain('api.put(remoteDraftUrl(key), draft)');
    expect(source).toContain('api.delete(remoteDraftUrl(key))');
  });
});
