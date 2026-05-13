import { Request } from 'express';
import { describe, expect, it } from 'vitest';
import {
  buildQianFuNotifyReplayKey,
  buildPayProNotifyReplayKey,
  buildXpayNotifyReplayKey,
  extractRequestClientIp,
  isNotifyIpAllowed,
  normalizeClientIp,
  parseNotifyIpAllowlist,
  resolveNotifyIpAllowlist,
} from '../../server/services/paymentCallbackSecurity';

const toRequest = (value: Partial<Request>): Request => value as Request;

describe('payment callback security', () => {
  it('should normalize proxy/client IP formats', () => {
    expect(normalizeClientIp(' 203.0.113.10:443 ')).toBe('203.0.113.10');
    expect(normalizeClientIp('[2001:db8::10]:9443')).toBe('2001:db8::10');
    expect(normalizeClientIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeClientIp('localhost')).toBe('127.0.0.1');
  });

  it('should parse and normalize allowlist values', () => {
    const allowlist = parseNotifyIpAllowlist('127.0.0.1, localhost,\n2001:db8::10');
    expect(allowlist.has('127.0.0.1')).toBe(true);
    expect(allowlist.has('2001:db8::10')).toBe(true);
    expect(allowlist.size).toBe(2);
  });

  it('should prefer provider allowlist and fallback to global allowlist', () => {
    const providerAllowlist = resolveNotifyIpAllowlist('198.51.100.8', '203.0.113.6');
    expect(Array.from(providerAllowlist)).toEqual(['198.51.100.8']);

    const globalAllowlist = resolveNotifyIpAllowlist('', '203.0.113.6');
    expect(Array.from(globalAllowlist)).toEqual(['203.0.113.6']);
  });

  it('should extract client IP from callback headers with precedence', () => {
    const req = toRequest({
      headers: {
        'cf-connecting-ip': '198.51.100.6',
        'x-real-ip': '198.51.100.7',
        'x-forwarded-for': '198.51.100.8, 10.0.0.1',
      },
      ip: '127.0.0.1',
    });

    expect(extractRequestClientIp(req)).toBe('198.51.100.6');

    const req2 = toRequest({
      headers: {
        'x-forwarded-for': '203.0.113.9, 10.0.0.2',
      },
      ip: '127.0.0.1',
    });

    expect(extractRequestClientIp(req2)).toBe('203.0.113.9');
  });

  it('should allow when allowlist is empty and reject missing ip when restricted', () => {
    const emptyAllowlist = new Set<string>();
    expect(isNotifyIpAllowed(null, emptyAllowlist)).toBe(true);

    const strictAllowlist = parseNotifyIpAllowlist('203.0.113.5');
    expect(isNotifyIpAllowed(null, strictAllowlist)).toBe(false);
    expect(isNotifyIpAllowed('203.0.113.5', strictAllowlist)).toBe(true);
    expect(isNotifyIpAllowed('203.0.113.6', strictAllowlist)).toBe(false);
  });

  it('should build stable replay keys for xpay and paypro callbacks', () => {
    const xpayA = buildXpayNotifyReplayKey({
      mark: 'order_1',
      dt: '1710000000000',
      money: '9.90',
      sign: 'ABCDEF',
    });
    const xpayB = buildXpayNotifyReplayKey({
      mark: 'order_1',
      dt: '1710000000000',
      money: '9.90',
      sign: 'abcdef',
    });
    expect(xpayA).toBe(xpayB);
    expect(xpayA.startsWith('payment:notify:replay:xpay:')).toBe(true);

    const payproA = buildPayProNotifyReplayKey({
      orderNo: 'order_2',
      payNum: 'pay_001',
      amount: '18.80',
      sign: 'abc123',
    });
    const payproB = buildPayProNotifyReplayKey({
      orderNo: 'order_2',
      payNum: 'pay_001',
      amount: '18.80',
      sign: 'ABC123',
    });
    expect(payproA).toBe(payproB);
    expect(payproA.startsWith('payment:notify:replay:paypro:')).toBe(true);

    const qianfuA = buildQianFuNotifyReplayKey({
      outTradeNo: 'order_3',
      tradeNo: 'trade_3',
      payType: 'wechat',
      amount: '18.80',
      status: 'SUCCESS',
      payTime: 1710000011,
      sign: 'abC123',
    });
    const qianfuB = buildQianFuNotifyReplayKey({
      outTradeNo: 'order_3',
      tradeNo: 'trade_3',
      payType: 'wechat',
      amount: '18.80',
      status: 'SUCCESS',
      payTime: 1710000011,
      sign: 'ABC123',
    });
    expect(qianfuA).toBe(qianfuB);
    expect(qianfuA.startsWith('payment:notify:replay:qianfu:')).toBe(true);
  });
});
