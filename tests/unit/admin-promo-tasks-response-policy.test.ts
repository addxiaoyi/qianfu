import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/admin/AdminPromoTasks.tsx'),
  'utf8',
);

describe('admin promotion task response handling', () => {
  it('uses the shared paginated task API and unwraps its data array', () => {
    expect(page).toMatch(/import\s+\{\s*promotionApi\s*\}\s+from\s+['"]@\/api\/promotionApi['"]/);
    expect(page).toMatch(/queryFn:\s*promotionApi\.listTasks/);
    expect(page).toMatch(/const tasks = useMemo\(\(\) => data\?\.data \?\? \[\], \[data\]\);/);
  });
});
