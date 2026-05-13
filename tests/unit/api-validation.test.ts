/**
 * Unit tests for API validation schemas
 */
import { describe, it, expect } from 'vitest';
import { profileUpdateSchema } from '../../server/utils/validation';
import { mcStatusDirectTestSchema } from '../../server/utils/validation';
import { createServerSchema } from '../../server/core/validation/schemas';

describe('Validation Schemas', () => {
  describe('profileUpdateSchema', () => {
    it('should validate valid profile update', () => {
      const validData = {
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
        bio_html: '<p>Hello World</p>',
        preferences: { theme: 'dark' },
      };
      
      const result = profileUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject username shorter than 2 characters', () => {
      const invalidData = {
        username: 'a',
      };
      
      const result = profileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject username longer than 50 characters', () => {
      const invalidData = {
        username: 'a'.repeat(51),
      };
      
      const result = profileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid avatar_url format', () => {
      const invalidData = {
        avatar_url: 'not-a-url',
      };
      
      const result = profileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept empty object (all fields optional)', () => {
      const result = profileUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate bio_html with allowed tags', () => {
      const validData = {
        bio_html: '<p><strong>Bold</strong> and <em>italic</em></p>',
      };
      
      const result = profileUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('createServerSchema', () => {
    it('should validate minimal server data', () => {
      const validData = {
        name: 'My Server',
        host: 'mc.example.com',
        port: 25565,
      };
      
      const result = createServerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        name: 'My Server',
      };
      
      const result = createServerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate port range', () => {
      const validData = {
        name: 'My Server',
        host: 'mc.example.com',
        port: 25565,
      };
      
      const result = createServerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid port', () => {
      const invalidData = {
        name: 'My Server',
        host: 'mc.example.com',
        port: 70000,
      };
      
      const result = createServerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('mcStatusDirectTestSchema', () => {
    it('should validate valid host', () => {
      const validData = {
        host: 'mc.hypixel.net',
        type: 'java',
      };
      
      const result = mcStatusDirectTestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const invalidData = {
        host: 'mc.example.com',
        type: 'invalid',
      };
      
      const result = mcStatusDirectTestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should default type to java', () => {
      const validData = {
        host: 'mc.example.com',
      };
      
      const result = mcStatusDirectTestSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('java');
      }
    });
  });
});
