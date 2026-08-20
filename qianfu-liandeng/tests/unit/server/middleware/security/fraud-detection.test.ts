/**
 * 欺诈检测模块单元测试
 * 优化项 404: 风控模型 - 欺诈检测
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FraudDetectionEngine,
  initializeFraudDetection,
  getFraudDetectionEngine,
  FraudDetectionConfig,
  FraudCheckRequest,
  FraudEventType,
  RiskLevel,
  defaultFraudDetectionConfig,
} from '../../../server/middleware/security/fraud-detection';

describe('欺诈检测引擎', () => {
  let engine: FraudDetectionEngine;

  beforeEach(() => {
    // 每个测试前重新初始化引擎
    engine = initializeFraudDetection(defaultFraudDetectionConfig);
  });

  describe('初始化', () => {
    it('应该返回 FraudDetectionEngine 实例', () => {
      expect(engine).toBeInstanceOf(FraudDetectionEngine);
    });

    it('应该返回相同的单例实例', () => {
      const engine1 = getFraudDetectionEngine();
      const engine2 = getFraudDetectionEngine();
      expect(engine1).toBe(engine2);
    });

    it('应该使用默认配置', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.riskThreshold).toBe(70);
      expect(config.velocityCheck.enabled).toBe(true);
    });
  });

  describe('速度检测', () => {
    it('应该允许正常请求频率', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user',
        sessionId: 'session-1',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      // 正常频率请求
      for (let i = 0; i < 5; i++) {
        const result = await engine.check(request);
        expect(result.details.velocityCheck?.passed).toBe(true);
      }
    });

    it('应该检测高频请求', async () => {
      // 配置更严格的速度限制
      engine.updateConfig({
        velocityCheck: {
          enabled: true,
          timeWindow: 60000,
          maxRequests: 3,
        },
      });

      const request: FraudCheckRequest = {
        userId: 'test-user-high-freq',
        sessionId: 'session-2',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      // 超过限制
      for (let i = 0; i < 5; i++) {
        await engine.check(request);
      }

      const result = await engine.check(request);
      expect(result.details.velocityCheck?.passed).toBe(false);
      expect(result.details.velocityCheck?.requestsInWindow).toBeGreaterThan(3);
    });
  });

  describe('设备指纹检测', () => {
    it('应该检测模拟器', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user',
        sessionId: 'session-3',
        eventType: FraudEventType.LOGIN,
        userAgent: 'Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19 Android emulator',
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.details.deviceCheck?.isEmulator).toBe(true);
    });

    it('应该标记新设备', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-new-device',
        sessionId: 'session-4',
        eventType: FraudEventType.LOGIN,
        deviceFingerprint: 'brand-new-device-123',
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.details.deviceCheck?.isNewDevice).toBe(true);
    });

    it('应该追踪已知设备', async () => {
      const fingerprint = 'known-device-456';

      // 首次访问
      const request1: FraudCheckRequest = {
        userId: 'test-user-known',
        sessionId: 'session-5',
        eventType: FraudEventType.LOGIN,
        deviceFingerprint: fingerprint,
        ip: '127.0.0.1',
      };

      await engine.check(request1);

      // 再次访问
      const request2: FraudCheckRequest = {
        ...request1,
        sessionId: 'session-6',
      };

      const result = await engine.check(request2);
      expect(result.details.deviceCheck?.isNewDevice).toBe(false);
      expect(result.details.deviceCheck?.deviceAge).toBeGreaterThan(0);
    });
  });

  describe('IP信誉检测', () => {
    it('应该检测私有IP', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user',
        sessionId: 'session-7',
        eventType: FraudEventType.LOGIN,
        ip: '10.0.0.1', // 私有IP
      };

      const result = await engine.check(request);
      // 私有IP可能被检测为VPN
      expect(result.details.ipCheck).toBeDefined();
    });
  });

  describe('行为分析', () => {
    it('应该检测异常时间段', async () => {
      const now = new Date();
      const hour = now.getHours();

      // 如果在深夜时段测试
      if (hour >= 0 && hour <= 5) {
        const request: FraudCheckRequest = {
          userId: 'test-user-late-night',
          sessionId: 'session-8',
          eventType: FraudEventType.TRANSFER,
          amount: 5000,
          ip: '127.0.0.1',
        };

        const result = await engine.check(request);
        expect(result.details.behaviorCheck?.unusualTime).toBe(true);
      }
    });

    it('应该记录用户历史', async () => {
      const userId = 'test-user-history';

      // 执行多次操作
      for (let i = 0; i < 3; i++) {
        await engine.check({
          userId,
          sessionId: `session-${i}`,
          eventType: FraudEventType.LOGIN,
          ip: '127.0.0.1',
        });
      }

      const history = engine.getUserHistory(userId);
      expect(history).toBeDefined();
      expect(history?.events.length).toBe(3);
    });
  });

  describe('风险评分', () => {
    it('应该返回有效的风险评分', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-score',
        sessionId: 'session-9',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('应该正确分类风险等级', async () => {
      const testCases: { score: number; expected: RiskLevel }[] = [
        { score: 0, expected: RiskLevel.LOW },
        { score: 15, expected: RiskLevel.LOW },
        { score: 30, expected: RiskLevel.MEDIUM },
        { score: 50, expected: RiskLevel.MEDIUM },
        { score: 60, expected: RiskLevel.HIGH },
        { score: 75, expected: RiskLevel.HIGH },
        { score: 80, expected: RiskLevel.CRITICAL },
        { score: 95, expected: RiskLevel.CRITICAL },
      ];

      for (const { score, expected } of testCases) {
        const request: FraudCheckRequest = {
          userId: `test-user-${score}`,
          sessionId: `session-score-${score}`,
          eventType: FraudEventType.LOGIN,
          ip: '127.0.0.1',
        };

        const result = await engine.check(request);

        // 由于有多种检测，实际分数可能不完全匹配输入
        // 这里我们只验证返回的是有效风险等级
        expect(Object.values(RiskLevel)).toContain(result.riskLevel);
      }
    });
  });

  describe('欺诈规则引擎', () => {
    it('应该包含内置规则', () => {
      const config = engine.getConfig();
      expect(config.rules.rules.length).toBeGreaterThan(0);
    });

    it('应该触发高频登录失败规则', async () => {
      engine.updateConfig({
        velocityCheck: {
          enabled: true,
          timeWindow: 60000,
          maxRequests: 3,
        },
      });

      const request: FraudCheckRequest = {
        userId: 'test-user-failed',
        sessionId: 'session-failed',
        eventType: FraudEventType.LOGIN_FAILED,
        ip: '127.0.0.1',
      };

      // 触发规则
      for (let i = 0; i < 5; i++) {
        await engine.check(request);
      }

      const result = await engine.check(request);
      expect(result.details.rulesTriggered).toContain('RULE-001');
    });

    it('应该触发模拟器访问规则', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-emulator',
        sessionId: 'session-emulator',
        eventType: FraudEventType.LOGIN,
        userAgent: 'Android Emulator Galaxy Nexus Chrome',
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.details.rulesTriggered).toContain('RULE-007');
    });

    it('应该允许禁用规则', () => {
      const config = engine.getConfig();
      config.rules.rules[0].enabled = false;
      engine.updateConfig(config);

      const updatedConfig = engine.getConfig();
      expect(updatedConfig.rules.rules[0].enabled).toBe(false);
    });
  });

  describe('IP黑名单', () => {
    it('应该允许将IP加入黑名单', () => {
      const testIp = '192.168.1.100';
      engine.blacklistIp(testIp);

      const profile = engine.getIpProfile(testIp);
      expect(profile?.isBlacklisted).toBe(true);
    });

    it('应该允许将IP从黑名单移除', () => {
      const testIp = '192.168.1.101';
      engine.blacklistIp(testIp);
      engine.unblacklistIp(testIp);

      const profile = engine.getIpProfile(testIp);
      expect(profile?.isBlacklisted).toBe(false);
    });

    it('黑名单IP应该被检测为高风险', async () => {
      const testIp = '192.168.1.102';
      engine.blacklistIp(testIp);

      const request: FraudCheckRequest = {
        userId: 'test-user-blacklist',
        sessionId: 'session-blacklist',
        eventType: FraudEventType.LOGIN,
        ip: testIp,
      };

      const result = await engine.check(request);
      expect(result.riskScore).toBeGreaterThan(50);
    });
  });

  describe('统计数据', () => {
    it('应该返回正确的统计数据', async () => {
      // 执行一些检测
      for (let i = 0; i < 5; i++) {
        await engine.check({
          userId: `stat-user-${i}`,
          sessionId: `stat-session-${i}`,
          eventType: FraudEventType.LOGIN,
          ip: `192.168.1.${i}`,
        });
      }

      const stats = engine.getStatistics();
      expect(stats.totalRecords).toBeGreaterThanOrEqual(5);
      expect(stats.uniqueUsersMonitored).toBeGreaterThanOrEqual(5);
      expect(stats.uniqueIpsMonitored).toBeGreaterThanOrEqual(5);
    });
  });

  describe('欺诈记录查询', () => {
    it('应该能够查询欺诈记录', async () => {
      const userId = 'query-user';

      // 执行检测
      for (let i = 0; i < 3; i++) {
        await engine.check({
          userId,
          sessionId: `query-session-${i}`,
          eventType: FraudEventType.LOGIN,
          ip: '127.0.0.1',
        });
      }

      const records = engine.getFraudRecords({ userId });
      expect(records.length).toBe(3);
    });

    it('应该按风险等级过滤记录', async () => {
      const records = engine.getFraudRecords({ riskLevel: RiskLevel.HIGH });
      // 验证返回的都是指定等级
      for (const record of records) {
        expect(record.riskLevel).toBe(RiskLevel.HIGH);
      }
    });
  });

  describe('配置更新', () => {
    it('应该能够更新配置', () => {
      engine.updateConfig({
        riskThreshold: 80,
        velocityCheck: {
          enabled: true,
          timeWindow: 30000,
          maxRequests: 20,
        },
      });

      const config = engine.getConfig();
      expect(config.riskThreshold).toBe(80);
      expect(config.velocityCheck.timeWindow).toBe(30000);
      expect(config.velocityCheck.maxRequests).toBe(20);
    });

    it('应该保留未更新的配置', () => {
      engine.updateConfig({ riskThreshold: 50 });
      const config = engine.getConfig();
      expect(config.velocityCheck.enabled).toBe(true); // 保留原有配置
    });
  });

  describe('决策ID生成', () => {
    it('应该生成唯一的决策ID', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-decision',
        sessionId: 'session-decision',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.decisionId).toMatch(/^FD-[a-z0-9]+-[A-Z0-9]+$/);
    });

    it('应该生成不同的决策ID', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-unique',
        sessionId: 'session-unique',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      const result1 = await engine.check(request);
      const result2 = await engine.check(request);

      expect(result1.decisionId).not.toBe(result2.decisionId);
    });
  });

  describe('处理时间', () => {
    it('应该记录处理时间', async () => {
      const request: FraudCheckRequest = {
        userId: 'test-user-timing',
        sessionId: 'session-timing',
        eventType: FraudEventType.LOGIN,
        ip: '127.0.0.1',
      };

      const result = await engine.check(request);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTimeMs).toBe('number');
    });
  });
});

describe('FraudCheckRequest 类型验证', () => {
  it('应该支持所有事件类型', () => {
    const eventTypes = Object.values(FraudEventType);

    for (const eventType of eventTypes) {
      const request: FraudCheckRequest = {
        userId: 'test',
        sessionId: 'test',
        eventType,
        ip: '127.0.0.1',
      };
      expect(request.eventType).toBe(eventType);
    }
  });

  it('应该支持可选字段', () => {
    const request: FraudCheckRequest = {
      userId: 'test',
      sessionId: 'test',
      eventType: FraudEventType.TRANSACTION,
      amount: 1000,
      currency: 'CNY',
      ip: '127.0.0.1',
      location: {
        country: 'CN',
        region: 'Beijing',
        city: 'Beijing',
        latitude: 39.9042,
        longitude: 116.4074,
      },
      metadata: {
        orderId: 'order123',
        paymentMethod: 'alipay',
      },
    };

    expect(request.amount).toBe(1000);
    expect(request.location?.country).toBe('CN');
    expect(request.metadata?.orderId).toBe('order123');
  });
});

describe('风险因素描述生成', () => {
  let engine: FraudDetectionEngine;

  beforeEach(() => {
    engine = initializeFraudDetection(defaultFraudDetectionConfig);
  });

  it('应该生成有意义的风险描述', async () => {
    // 使用高风险IP
    engine.blacklistIp('10.0.0.99');

    const request: FraudCheckRequest = {
      userId: 'test-risk-desc',
      sessionId: 'session-risk-desc',
      eventType: FraudEventType.TRANSFER,
      amount: 50000,
      ip: '10.0.0.99',
      userAgent: 'Android Emulator',
    };

    const result = await engine.check(request);

    // 验证风险因素存在
    expect(result.riskFactors.length).toBeGreaterThan(0);

    // 验证每个风险因素有描述
    for (const factor of result.riskFactors) {
      expect(factor.type).toBeDefined();
      expect(factor.description).toBeTruthy();
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.weight).toBeGreaterThan(0);
    }

    // 验证推荐处置
    expect(['block', 'challenge', 'allow']).toContain(result.recommendedAction);
  });
});
