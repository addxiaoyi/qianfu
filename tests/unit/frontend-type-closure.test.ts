import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('frontend type and runtime closure contracts', () => {
  it('exports existing shared components from their real locations', () => {
    const index = read('qianfu-liandeng/src/components/index.ts');

    expect(index).toContain("export * from './ui/admin/AdminSidebar';");
    expect(index).toContain("export * from './tags/TagSelector';");
    expect(index).toContain("export * from './mobile/MobileSkeleton';");
    expect(index).not.toContain("export * from './layout/AdminSidebar';");
  });

  it('keeps browser-safe permission and tag definitions erasable', () => {
    expect(read('qianfu-liandeng/src/auth/permissions.ts')).not.toContain('export enum Permission');
    expect(read('qianfu-liandeng/src/types/tags.ts')).not.toContain('export enum TagCategory');
    expect(read('qianfu-liandeng/src/auth/guards.tsx')).toContain('export function LoadingFallback');
  });

  it('keeps shared UI helpers callable by their consumers', () => {
    expect(read('qianfu-liandeng/src/hooks/use-toast.ts')).toContain('export function dismiss');
    expect(read('qianfu-liandeng/src/utils/resource-preloader.ts')).toContain('preload(options: PreloadOptions)');
    expect(read('qianfu-liandeng/src/utils/resource-preloader.ts')).toContain('getResourceType(url: string)');
    expect(read('qianfu-liandeng/src/pages/admin/AdminUsers.tsx')).toContain('ChevronRight');
  });

  it('keeps form helpers wired to browser-safe implementations', () => {
    const fieldIndex = read('qianfu-liandeng/src/forms/fields/index.ts');
    const fieldTypes = read('qianfu-liandeng/src/forms/types.ts');
    const schemas = read('qianfu-liandeng/src/forms/schemas.ts');
    const devtools = read('qianfu-liandeng/src/forms/devtools.ts');

    expect(fieldIndex).toContain("from '../fields'");
    expect(fieldIndex).not.toContain("from './FormInput'");
    expect(fieldTypes).toContain('control: Control<T>');
    expect(schemas).not.toContain('errorMap:');
    expect(devtools).not.toContain('process.env.NODE_ENV');
  });

  it('keeps browser hooks independent from NodeJS timer globals', () => {
    for (const file of [
      'qianfu-liandeng/src/forms/use-performance-form.ts',
      'qianfu-liandeng/src/hooks/useResourcePreload.ts',
      'qianfu-liandeng/src/hooks/useRoutePrefetch.tsx',
      'qianfu-liandeng/src/hooks/useSSE.ts',
    ]) {
      expect(read(file)).not.toContain('NodeJS.Timeout');
    }
  });

  it('keeps the Druid dashboard imports explicit', () => {
    const page = read('qianfu-liandeng/src/pages/admin/DruidDashboard.tsx');

    expect(page).toContain('motion');
    expect(page).toContain('Users');
    expect(page).toContain('Clock');
  });

  it('keeps the examples barrel backed by a real module', () => {
    expect(read('qianfu-liandeng/src/pages/examples/FormExamples.tsx')).toContain('BasicFormExample');
  });

  it('keeps mobile featured servers on the shared public-list type', () => {
    const mobileHome = read('qianfu-liandeng/src/pages/MobileHome.tsx');

    expect(mobileHome).toContain("import type { ServerListItem } from '@/types/server';");
    expect(mobileHome).toContain("request<ServerListItem[]>('/public/servers'");
    expect(mobileHome).toContain('toArray<ServerListItem>(featuredServerResponse)');
    expect(mobileHome).not.toContain("request<any>('/public/servers'");
    expect(mobileHome).not.toContain('toArray<any>(featuredServerResponse)');
    expect(mobileHome).not.toContain('(server: any)');
  });
});
