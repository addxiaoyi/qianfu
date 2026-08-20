import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('frontend information exposure policy', () => {
  it('does not install anti-debugging runtime handlers', () => {
    const main = read('qianfu-liandeng/src/main.tsx');

    expect(main).not.toContain('installDevToolsShortcutGuard');
    expect(main).not.toContain('installDevToolsTimingGuard');
  });

  it('keeps form diagnostics opt-in and value-free', () => {
    const source = read('qianfu-liandeng/src/forms/devtools.ts');

    expect(source).toContain('enabled = false');
    expect(source).not.toContain('prevValue ??');
    expect(source).not.toContain('currentValue ??');
    expect(source).not.toContain('logFn(`[FormDevtools] ${message}`, data ?? \'\')');
    expect(source).not.toContain('log(\'Form submitted with validation errors\', formState.errors)');
  });
});
