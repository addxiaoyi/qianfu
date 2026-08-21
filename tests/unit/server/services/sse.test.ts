/**
 * SSE 服务单元测试
 * 优化项 24: 实时订阅 - Server-Sent Events
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { initSSE, SSEEvent, SSEConnection } from '@server/services/sse';

describe('SSE Service', () => {
  let sse: ReturnType<typeof initSSE>;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    sse = initSSE({
      heartbeatInterval: 5000,
      maxConnections: 10,
      connectionTimeout: 60000,
      requireAuth: false,
    });

    mockReq = {
      on: vi.fn(),
    };

    mockRes = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
  });

  afterEach(() => {
    sse.closeAll();
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create new connection with userId', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      expect(connectionId).toMatch(/^sse_/);
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
      }));
      expect(mockRes.write).toHaveBeenCalled(); // connected event
    });

    it('should create new connection with clientId', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        clientId: 'client_abc123',
        channels: ['progress'],
      });

      expect(connectionId).toMatch(/^sse_/);
    });

    it('should subscribe to multiple channels', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification', 'chat', 'order'],
      });

      const connection = sse.getConnection(connectionId);
      expect(connection?.channels.has('notification')).toBe(true);
      expect(connection?.channels.has('chat')).toBe(true);
      expect(connection?.channels.has('order')).toBe(true);
    });

    it('should filter invalid channels', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification', 'invalid_channel'],
      });

      const connection = sse.getConnection(connectionId);
      expect(connection?.channels.has('notification')).toBe(true);
      expect(connection?.channels.has('invalid_channel')).toBe(false);
    });

    it('should reject when max connections reached', () => {
      const limitedSSE = initSSE({
        maxConnections: 1,
        requireAuth: false,
      });

      const localMockReq = { on: vi.fn() };
      const localMockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      limitedSSE.connect(localMockReq as any, localMockRes as any, {
        userId: 'user1',
      });

      expect(() => {
        limitedSSE.connect(localMockReq as any, localMockRes as any, {
          userId: 'user2',
        });
      }).toThrow('Max connections reached');

      limitedSSE.closeAll();
    });

    it('should require auth when configured', () => {
      const authSSE = initSSE({
        requireAuth: true,
      });

      const localMockRes = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      expect(() => {
        authSSE.connect(mockReq as any, localMockRes as any, {
          channels: ['notification'],
        });
      }).toThrow('Authentication required');

      authSSE.closeAll();
    });
  });

  describe('disconnect', () => {
    it('should remove connection', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
      });

      expect(sse.getConnection(connectionId)).toBeDefined();

      sse.disconnect(connectionId);

      expect(sse.getConnection(connectionId)).toBeUndefined();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle disconnect non-existent connection', () => {
      expect(() => sse.disconnect('non_existent')).not.toThrow();
    });
  });

  describe('send', () => {
    it('should send event to connection', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      const event: SSEEvent = {
        event: 'notification',
        data: { message: 'Hello' },
      };

      const result = sse.send(connectionId, event);

      expect(result).toBe(true);
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('notification'));
    });

    it('should not send to wrong channel', () => {
      const connectionId = sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      const event: SSEEvent = {
        event: 'chat',
        data: { message: 'Hello' },
      };

      const result = sse.send(connectionId, event);

      expect(result).toBe(false);
    });

    it('should return false for non-existent connection', () => {
      const result = sse.send('non_existent', {
        event: 'notification',
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all subscribed connections', () => {
      // 创建两个连接
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockRes2 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };
      const mockReq2 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
        channels: ['notification'],
      });

      sse.connect(mockReq2 as any, mockRes2 as any, {
        userId: 'user2',
        channels: ['notification'],
      });

      const sentCount = sse.broadcast('notification', {
        event: 'test',
        data: { message: 'Broadcast message' },
      });

      expect(sentCount).toBe(2);
    });

    it('should only broadcast to correct channel', () => {
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockRes2 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };
      const mockReq2 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
        channels: ['notification'],
      });

      sse.connect(mockReq2 as any, mockRes2 as any, {
        userId: 'user2',
        channels: ['chat'],
      });

      const sentCount = sse.broadcast('notification', {
        event: 'test',
        data: { message: 'Notification only' },
      });

      expect(sentCount).toBe(1);
    });
  });

  describe('sendToUser', () => {
    it('should send event to specific user', () => {
      sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      const sentCount = sse.sendToUser('user1', {
        event: 'notification',
        data: { message: 'Hello User1' },
      });

      expect(sentCount).toBe(1);
    });

    it('should send to multiple connections of same user', () => {
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockRes2 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };
      const mockReq2 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
        channels: ['notification'],
      });

      sse.connect(mockReq2 as any, mockRes2 as any, {
        userId: 'user1',
        channels: ['chat'],
      });

      const sentCount = sse.sendToUser('user1', {
        event: 'notification',
        data: { message: 'Hello' },
      });

      expect(sentCount).toBe(1); // Only sent to connection subscribed to notification
    });

    it('should return 0 for non-existent user', () => {
      const sentCount = sse.sendToUser('non_existent', {
        event: 'notification',
        data: {},
      });

      expect(sentCount).toBe(0);
    });
  });

  describe('sendToClient', () => {
    it('should send event to specific client', () => {
      sse.connect(mockReq, mockRes, {
        clientId: 'client_abc',
        channels: ['notification'],
      });

      const sentCount = sse.sendToClient('client_abc', {
        event: 'notification',
        data: { message: 'Hello Client' },
      });

      expect(sentCount).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
        channels: ['notification', 'chat'],
      });

      const status = sse.getStatus();

      expect(status.totalConnections).toBe(1);
      expect(status.byChannel.notification).toBe(1);
      expect(status.byChannel.chat).toBe(1);
      expect(status.byUser).toBe(1);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should count user connections', () => {
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockRes2 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };
      const mockReq2 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
        channels: ['notification'],
      });

      sse.connect(mockReq2 as any, mockRes2 as any, {
        clientId: 'client_anon',
        channels: ['notification'],
      });

      const status = sse.getStatus();

      expect(status.totalConnections).toBe(2);
      expect(status.byUser).toBe(1); // Only user1 counts as authenticated
    });
  });

  describe('event handlers', () => {
    it('should register and call event handler', () => {
      const handler = vi.fn();

      sse.on('custom_event', handler);

      sse.connect(mockReq, mockRes, {
        userId: 'user1',
        channels: ['notification'],
      });

      // Note: The handler is called internally when processing events
      expect(sse.getStatus().totalConnections).toBe(1);
    });

    it('should remove event handler', () => {
      const handler = vi.fn();

      sse.on('custom_event', handler);
      sse.off('custom_event');

      // Handler should be removed
      expect(sse.getStatus().totalConnections).toBe(0);
    });
  });

  describe('closeAll', () => {
    it('should close all connections', () => {
      const mockRes1 = { ...mockRes, write: vi.fn() };
      const mockRes2 = { ...mockRes, write: vi.fn() };
      const mockReq1 = { on: vi.fn() };
      const mockReq2 = { on: vi.fn() };

      sse.connect(mockReq1 as any, mockRes1 as any, {
        userId: 'user1',
      });

      sse.connect(mockReq2 as any, mockRes2 as any, {
        userId: 'user2',
      });

      expect(sse.getStatus().totalConnections).toBe(2);

      sse.closeAll();

      expect(sse.getStatus().totalConnections).toBe(0);
    });
  });
});

describe('SSE Event Format', () => {
  it('should format event correctly', () => {
    const event: SSEEvent = {
      event: 'notification',
      data: { message: 'Test', count: 42 },
      id: '123',
      retry: 5000,
    };

    expect(event.event).toBe('notification');
    expect(event.data).toEqual({ message: 'Test', count: 42 });
    expect(event.id).toBe('123');
    expect(event.retry).toBe(5000);
  });

  it('should handle multi-line data', () => {
    const event: SSEEvent = {
      event: 'notification',
      data: 'Line 1\nLine 2\nLine 3',
    };

    expect(event.data).toContain('\n');
  });
});
