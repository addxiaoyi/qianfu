import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('registration input policy contract', () => {
  it('matches the backend username and password requirements before submitting', () => {
    const source = read('qianfu-liandeng/src/pages/Register.tsx');
    const schemaStart = source.indexOf('const registerSchema =');
    const schemaEnd = source.indexOf('type RegisterFormValues', schemaStart);
    const schema = source.slice(schemaStart, schemaEnd);

    expect(schema).toContain('.max(30');
    expect(schema).toContain('/^[a-zA-Z0-9_-]+$/');
    expect(schema).toContain('.min(6');
    expect(schema).not.toContain('.min(12');
    expect(schema).toContain('.max(100');
    expect(schema).toContain('.regex(/[a-z]/');
    expect(schema).toContain('.regex(/[A-Z]/');
    expect(schema).toContain('.regex(/\\d/');
    expect(schema).toContain('.regex(/[^a-zA-Z0-9]/');
  });
});
