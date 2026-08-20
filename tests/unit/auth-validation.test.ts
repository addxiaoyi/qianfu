import type { ZodType } from 'zod';
import { describe, expect, it } from 'vitest';
import * as validation from '../../server/utils/validation';

type AuthSchemas = {
  registerSchema?: ZodType;
  loginSchema?: ZodType;
  authCodeRequestSchema?: ZodType;
  authCodeVerifySchema?: ZodType;
  forgotPasswordSchema?: ZodType;
  resetPasswordCodeSchema?: ZodType;
  resetPasswordTokenSchema?: ZodType;
};

const schemas = validation as AuthSchemas;

function requireSchema(name: keyof AuthSchemas): ZodType | undefined {
  const schema = schemas[name];
  expect(schema, `${name} must be exported`).toBeDefined();
  return schema;
}

describe('authentication request validation', () => {
  it('accepts username or email login identifiers', () => {
    const schema = requireSchema('loginSchema');
    if (!schema) return;

    expect(schema.safeParse({ identifier: 'user_name', password: 'secret' }).success).toBe(true);
    expect(schema.safeParse({ email: 'user@example.com', password: 'secret' }).success).toBe(true);
    expect(schema.safeParse({ identifier: '', password: 'secret' }).success).toBe(false);
  });

  it('validates the real registration payload without trusting extra fields', () => {
    const schema = requireSchema('registerSchema');
    if (!schema) return;

    const valid = {
      email: 'new@example.com',
      username: 'new_user',
      password: 'Long_password_123',
      confirmPassword: 'Long_password_123',
      agree: true,
    };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({
      ...valid,
      password: 'Aa1!xx',
      confirmPassword: 'Aa1!xx',
    }).success).toBe(true);
    expect(schema.safeParse({
      ...valid,
      password: 'Aa1!x',
      confirmPassword: 'Aa1!x',
    }).success).toBe(false);
    expect(schema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false);
  });

  it('requires exactly one valid address for code delivery', () => {
    const schema = requireSchema('authCodeRequestSchema');
    if (!schema) return;

    expect(schema.safeParse({ email: 'user@example.com' }).success).toBe(true);
    expect(schema.safeParse({ phone: '+8613800138000' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ email: 'bad', phone: '123' }).success).toBe(false);
  });

  it('requires a six-digit verification code', () => {
    const schema = requireSchema('authCodeVerifySchema');
    if (!schema) return;

    expect(schema.safeParse({ email: 'user@example.com', code: '123456' }).success).toBe(true);
    expect(schema.safeParse({ email: 'user@example.com', code: '12345' }).success).toBe(false);
  });

  it('separates code and token password reset contracts', () => {
    const codeSchema = requireSchema('resetPasswordCodeSchema');
    const tokenSchema = requireSchema('resetPasswordTokenSchema');
    if (!codeSchema || !tokenSchema) return;

    expect(codeSchema.safeParse({ email: 'user@example.com', code: '123456', password: 'New_password_123' }).success).toBe(true);
    expect(tokenSchema.safeParse({ token: 'a'.repeat(64), password: 'New_password_123' }).success).toBe(true);
    expect(tokenSchema.safeParse({ email: 'user@example.com', password: 'New_password_123' }).success).toBe(false);
  });
});
