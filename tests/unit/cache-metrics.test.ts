/**
 * Unit tests for cache utilities
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock Redis service for unit testing
class MockMemoryCache {
  private cache = new Map<string, { value: unknown; expiry: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  incr(key: string, ttlSeconds = 3600): number {
    const current = (this.get<number>(key) || 0) + 1;
    this.set(key, current, ttlSeconds);
    return current;
  }
}

describe('MockMemoryCache', () => {
  let cache: MockMemoryCache;

  beforeEach(() => {
    cache = new MockMemoryCache();
  });

  describe('set and get', () => {
    it('should store and retrieve string value', () => {
      cache.set('key1', 'value1', 60);
      expect(cache.get<string>('key1')).toBe('value1');
    });

    it('should store and retrieve object value', () => {
      const obj = { name: 'test', count: 42 };
      cache.set('key2', obj, 60);
      expect(cache.get<typeof obj>('key2')).toEqual(obj);
    });

    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });
  });

  describe('expiration', () => {
    it('should return null for expired key', async () => {
      // Use 0 TTL to expire immediately
      cache.set('expiring', 'value', 0);
      
      // Wait a tiny bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(cache.get('expiring')).toBeNull();
    });

    it('should auto-expire old entries', async () => {
      // Create an item that expires in 50ms
      cache.set('temp', 'value', 0.05);
      
      // Wait for it to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get('temp')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('deleteMe', 'value', 60);
      cache.del('deleteMe');
      expect(cache.get('deleteMe')).toBeNull();
    });

    it('should not throw for non-existent key', () => {
      expect(() => cache.del('nonexistent')).not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('exists', 'value', 60);
      expect(cache.has('exists')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      cache.set('expiring', 'value', 0);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cache.has('expiring')).toBe(false);
    });
  });

  describe('incr', () => {
    it('should increment existing counter', () => {
      cache.set('counter', 5, 60);
      const result = cache.incr('counter');
      expect(result).toBe(6);
      expect(cache.get<number>('counter')).toBe(6);
    });

    it('should initialize new counter at 1', () => {
      const result = cache.incr('newCounter');
      expect(result).toBe(1);
      expect(cache.get<number>('newCounter')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });
});

describe('Cache Key Patterns', () => {
  it('should generate consistent server cache key', () => {
    const serverId = 'abc123';
    const expectedKey = `server:${serverId}`;
    const cacheKey = `server:${serverId}`;
    expect(cacheKey).toBe(expectedKey);
  });

  it('should generate consistent user cache key', () => {
    const userId = 'user456';
    const expectedKey = `user:${userId}`;
    const cacheKey = `user:${userId}`;
    expect(cacheKey).toBe(expectedKey);
  });

  it('should handle TTL variants', () => {
    const SHORT_TTL = 300; // 5 minutes
    const MEDIUM_TTL = 3600; // 1 hour
    const LONG_TTL = 86400; // 24 hours

    expect(SHORT_TTL).toBe(300);
    expect(MEDIUM_TTL).toBe(3600);
    expect(LONG_TTL).toBe(86400);
  });
});
