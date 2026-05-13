import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModerationService } from '../../server/services/moderationService.js';
import axios from 'axios';
import prisma from '../../server/db';
import { logger } from '../../server/utils/logger';

// ============================================================
// Module mocks
// ============================================================

vi.mock('axios');
vi.mock('../../server/db', () => ({
  default: {
    moderationLog: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('../../server/services/configService.js', () => ({
  getConfig: vi.fn(),
}));

import { getConfig } from '../../server/services/configService.js';

const mockAxios = axios as any;
const mockPrisma = prisma as any;
const mockLogger = logger as any;
const mockGetConfig = getConfig as any;

// Accumulating config values (fixes fallback tests that need both keys)
const mockConfigMap = new Map<string, any>();

function mockConfigValue(key: string, value: any) {
  mockConfigMap.set(key, value);
  mockGetConfig.mockImplementation(async (k: string) => {
    return mockConfigMap.get(k);
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigMap.clear();
  process.env.ZHIPU_API_KEY = 'test-zhipu-key';
  mockAxios.post.mockResolvedValue({ data: {} });
  mockPrisma.moderationLog.create.mockResolvedValue({ id: 1 });
  mockPrisma.moderationLog.count.mockResolvedValue(0);
});

afterEach(() => {
  process.env.ZHIPU_API_KEY = ORIGINAL_ENV.ZHIPU_API_KEY;
  vi.restoreAllMocks();
  mockConfigMap.clear();
});

// ============================================================
// checkText
// ============================================================

describe('ModerationService.checkText', () => {
  it('should return passed:true when moderation is disabled', async () => {
    mockConfigValue('MODERATION_ENABLED', 'false');
    const result = await ModerationService.checkText('hello world');
    expect(result).toEqual({ passed: true });
  });

  it('should call ZHIPU API and return passed:true on safe content', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: true, score: 0.1 }) } }],
      },
    });

    const result = await ModerationService.checkText('hello world', 42);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.1);
    expect(result.reason).toBeUndefined();
    expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 42,
          content_type: 'TEXT',
          action: 'PASSED',
          reason: null,
        }),
      }),
    );
  });

  it('should return passed:false when ZHIPU rejects content', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: false, reason: 'Contains spam', score: 0.8 }) } }],
      },
    });

    const result = await ModerationService.checkText('buy cheap pills', 42);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('Contains spam');
    expect(result.score).toBe(0.8);
    expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 42,
          content_type: 'TEXT',
          action: 'REJECTED',
          reason: 'Contains spam (Score: 0.8)',
        }),
      }),
    );
  });

  it('should slice long content to 200 chars when logging', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: true }) } }],
      },
    });

    const longContent = 'a'.repeat(500);
    await ModerationService.checkText(longContent);

    const loggedContent = (mockPrisma.moderationLog.create.mock.calls[0][0].data as any).content;
    expect(loggedContent.length).toBe(200);
  });

  it('should fall back to OpenAI when ZHIPU throws and OpenAI key is configured', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockConfigValue('MODERATION_API_KEY', 'sk-openai-key');

    // ZHIPU fails first
    mockAxios.post
      .mockRejectedValueOnce(new Error('ZHIPU timeout'))
      // OpenAI succeeds
      .mockResolvedValueOnce({
        data: { results: [{ flagged: false, categories: { hate: false }, category_scores: { hate: 0.01 } }] },
      });

    const result = await ModerationService.checkText('hello world');

    expect(result.passed).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[ModerationService] ZHIPU text moderation failed:',
      expect.any(String),
    );
  });

  it('should return passed:true when ZHIPU throws and no OpenAI key', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    // No MODERATION_API_KEY configured -> fallback to default pass
    mockAxios.post.mockRejectedValueOnce(new Error('ZHIPU fail'));

    const result = await ModerationService.checkText('hello world');

    expect(result.passed).toBe(true); // No moderation configured, default pass
  });

  it('should return passed:false with PENDING log when moderation throws in try block', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');

    // Simulate error that falls into the outer `catch` block
    // The simplest way: make getConfig throw
    mockGetConfig.mockImplementation(async (k: string) => {
      if (k === 'MODERATION_ENABLED') return 'true';
      throw new Error('ConfigService down');
    });

    const result = await ModerationService.checkText('hello world', 42);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('Content moderation service temporarily unavailable. Content queued for manual review.');
    expect(result.score).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledWith('[ModerationService] Text moderation error:', 'ConfigService down');
    expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PENDING',
          reason: 'Service unavailable: ConfigService down',
        }),
      }),
    );
  });
});

// ============================================================
// checkImage
// ============================================================

describe('ModerationService.checkImage', () => {
  it('should return passed:true when moderation is disabled', async () => {
    mockConfigValue('MODERATION_ENABLED', 'false');
    const result = await ModerationService.checkImage('https://example.com/image.png');
    expect(result).toEqual({ passed: true });
  });

  it('should call ZHIPU image moderation and return passed:true', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: true, score: 0.05, reason: 'safe' }) } }],
      },
    });

    const result = await ModerationService.checkImage('https://example.com/img.png', 42);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.05);
    expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 42,
          content_type: 'IMAGE',
          action: 'PASSED',
        }),
      }),
    );
  });

  it('should return passed:false when ZHIPU rejects image', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: false, reason: 'NSFW', score: 0.95 }) } }],
      },
    });

    const result = await ModerationService.checkImage('https://example.com/bad.png');

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('NSFW');
  });

  it('should fall back to OpenAI when ZHIPU image moderation fails', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockConfigValue('MODERATION_API_KEY', 'sk-openai-key');

    mockAxios.post
      .mockRejectedValueOnce(new Error('ZHIPU image timeout'))
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: JSON.stringify({ passed: true, reason: 'ok', score: 0.1 }) } }],
        },
      });

    const result = await ModerationService.checkImage('https://example.com/img.png');

    expect(result.passed).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[ModerationService] ZHIPU image moderation failed, falling back to OpenAI:',
      expect.any(String),
    );
  });

  it('should return passed:false with PENDING log on error', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');

    // Make getConfig throw to hit outer catch
    mockGetConfig.mockImplementation(async (k: string) => {
      if (k === 'MODERATION_ENABLED') return 'true';
      throw new Error('DB down');
    });

    const result = await ModerationService.checkImage('https://example.com/img.png', 42);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('Image moderation service temporarily unavailable. Content queued for manual review.');
    expect(mockLogger.error).toHaveBeenCalledWith('[ModerationService] Image moderation error:', 'DB down');
    expect(mockPrisma.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PENDING',
          content_type: 'IMAGE',
        }),
      }),
    );
  });

  it('should slice long image URL to 255 chars when logging', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify({ passed: true }) } }],
      },
    });

    const longUrl = 'https://example.com/' + 'a'.repeat(500);
    await ModerationService.checkImage(longUrl);

    const loggedContent = (mockPrisma.moderationLog.create.mock.calls[0][0].data as any).content;
    expect(loggedContent.length).toBe(255);
  });

  it('should return passed:true when both ZHIPU and OpenAI fail for image', async () => {
    mockConfigValue('MODERATION_ENABLED', 'true');
    mockConfigValue('MODERATION_API_KEY', 'sk-openai-key');

    mockAxios.post
      .mockRejectedValueOnce(new Error('ZHIPU down'))
      .mockRejectedValueOnce(new Error('OpenAI down'));

    // When both fail, it should return default pass
    const result = await ModerationService.checkImage('https://example.com/img.png');

    expect(result.passed).toBe(true);
  });
});

// ============================================================
// getStats
// ============================================================

describe('ModerationService.getStats', () => {
  it('should return moderation statistics', async () => {
    mockPrisma.moderationLog.count
      .mockResolvedValueOnce(100)   // total
      .mockResolvedValueOnce(10)    // rejected
      .mockResolvedValueOnce(5);    // last24h

    const stats = await ModerationService.getStats();

    expect(stats.total).toBe(100);
    expect(stats.rejected).toBe(10);
    expect(stats.last24h).toBe(5);
    expect(stats.passRate).toBe('90.00%');
  });

  it('should return 100% passRate when no logs exist', async () => {
    mockPrisma.moderationLog.count.mockResolvedValue(0);

    const stats = await ModerationService.getStats();

    expect(stats.total).toBe(0);
    expect(stats.passRate).toBe('100%');
  });
});
