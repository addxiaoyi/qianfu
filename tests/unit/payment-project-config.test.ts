import { describe, expect, it } from 'vitest';

import {
  buildGlobalStatus,
  buildMaskedSecrets,
  buildPaymentProjectConfig,
  buildProviderReadiness,
  buildQiuPayDiagnosticTests,
  assertPaymentNotifyUrl,
  normalizePaymentProjectConfig,
  resolvePaymentProjectTestProvider,
  redactPaymentProjectConfig,
} from '../../server/controllers/paymentProjectController';

describe('payment project configuration', () => {
  it('marks V免签 ready without an EPay merchant PID', () => {
    const readiness = buildProviderReadiness({
      qiupayBaseUrl: 'https://v.0st.top',
      qiupayKey: 'vmq-key',
    });

    expect(readiness.qiupay).toBe(true);
  });

  it('does not report a missing PID for V免签 diagnostics', () => {
    const tests = buildQiuPayDiagnosticTests({
      qiupayBaseUrl: 'https://v.0st.top',
      qiupayKey: 'vmq-key',
      qiupayNotifyUrl: '',
    });

    expect(tests).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'qiupayBaseUrl', ok: true }),
      expect.objectContaining({ name: 'qiupayKey', ok: true }),
    ]));
    expect(tests.find((test) => test.name === 'qiupayPid')).toBeUndefined();
    expect(tests.every((test) => test.ok)).toBe(true);
  });

  it('keeps PayPal credentials when saving a V免签 project', () => {
    const config = buildPaymentProjectConfig('qianfu', {
      displayName: 'Qianfu',
      upstreamProvider: 'qiupay',
      backupUpstreamProvider: 'paypal',
      qiupayBaseUrl: 'https://v.0st.top',
      qiupayKey: 'vmq-key',
      paypalClientId: 'paypal-client-id',
      paypalClientSecret: 'paypal-client-secret',
    });

    expect(config).toMatchObject({
      upstreamProvider: 'qiupay',
      backupUpstreamProvider: 'paypal',
      qiupayBaseUrl: 'https://v.0st.top',
      qiupayKey: 'vmq-key',
      paypalClientId: 'paypal-client-id',
      paypalClientSecret: 'paypal-client-secret',
    });
  });

  it('removes a duplicate backup provider instead of presenting fake redundancy', () => {
    const config = buildPaymentProjectConfig('qianfu', {
      upstreamProvider: 'qiupay',
      backupUpstreamProvider: 'QIUPAY',
      qiupayBaseUrl: 'https://pay.example.com/mapi.php',
      qiupayPid: '12082',
      qiupayKey: 'merchant-key',
    });

    expect(config.backupUpstreamProvider).toBeUndefined();
  });

  it('normalizes persisted project configs before they are shown or used', () => {
    const config = normalizePaymentProjectConfig({
      upstreamProvider: ' QIUPAY ',
      backupUpstreamProvider: 'QIUPAY',
      displayName: 'Qianfu',
      qiupayKey: 'merchant-key',
      downstreamNotifyUrl: 'https://mc-u.top/api/v1/payment/notify',
    });

    expect(config).toMatchObject({
      upstreamProvider: 'qiupay',
      backupUpstreamProvider: undefined,
      displayName: 'Qianfu',
      qiupayKey: 'merchant-key',
      downstreamNotifyUrl: 'https://mc-u.top/api/v1/payment/notify',
    });
  });

  it('preserves stored secrets when the admin leaves masked fields unchanged', () => {
    const config = buildPaymentProjectConfig('qianfu', {
      upstreamProvider: 'qiupay',
      qiupayBaseUrl: 'https://pay.example.com/mapi.php',
      qiupayPid: '12082',
      qiupayKey: '',
    }, {
      qiupayKey: 'merchant-key',
    });

    expect(config.qiupayKey).toBe('merchant-key');
  });

  it('preserves the existing provider and gateway fields for a partial save', () => {
    const config = buildPaymentProjectConfig('qianfu', {
      displayName: 'Qianfu',
    }, {
      upstreamProvider: 'qiupay',
      qiupayBaseUrl: 'https://pay.mzfpay.com/xpay/epay/mapi.php',
      qiupayPid: '12082',
      qiupayKey: 'merchant-key',
    });

    expect(config).toMatchObject({
      upstreamProvider: 'qiupay',
      qiupayBaseUrl: 'https://pay.mzfpay.com/xpay/epay/mapi.php',
      qiupayPid: '12082',
      qiupayKey: 'merchant-key',
    });
  });

  it('accepts only the project callback route for QiuPay and V免签', () => {
    expect(() => assertPaymentNotifyUrl('qiupay', 'https://mc-u.top/api/v1/payment/qiupay/notify')).not.toThrow();
    expect(() => assertPaymentNotifyUrl('qiupay', 'https://v.0st.top/example/notify.php')).toThrow(/回调地址/);
  });

  it('marks an upstream example callback as not ready in diagnostics', () => {
    const notifyTest = buildQiuPayDiagnosticTests({
      qiupayBaseUrl: 'https://pay.mzfpay.com/xpay/epay/mapi.php',
      qiupayPid: '12082',
      qiupayKey: 'merchant-key',
      qiupayNotifyUrl: 'https://v.0st.top/example/notify.php',
    }).find((test) => test.name === 'qiupayNotifyUrl');

    expect(notifyTest).toMatchObject({ ok: false });
  });

  it('rejects a test-order provider outside the configured primary and backup chain', () => {
    const config = {
      upstreamProvider: 'qiupay',
      backupUpstreamProvider: 'xpay',
    };

    expect(resolvePaymentProjectTestProvider(config)).toBe('qiupay');
    expect(resolvePaymentProjectTestProvider(config, 'xpay')).toBe('xpay');
    expect(() => resolvePaymentProjectTestProvider(config, 'mzfpay')).toThrow(/provider/);
    expect(() => resolvePaymentProjectTestProvider(config, 'creem')).toThrow(/主通道或备用通道/);
    expect(() => resolvePaymentProjectTestProvider({ upstreamProvider: 'paypal' })).toThrow(/微信或支付宝/);
  });

  it('redacts secrets from the admin config payload while reporting readiness', () => {
    const config = {
      qiupayKey: 'merchant-key',
      paypalClientSecret: 'paypal-secret',
      qiupayBaseUrl: 'https://pay.example.com',
    };

    expect(redactPaymentProjectConfig(config)).toEqual({ qiupayBaseUrl: 'https://pay.example.com' });
    expect(buildMaskedSecrets(config)).toMatchObject({ qiupayKey: 'me****ey', paypalClientSecret: 'pa****et' });
  });

  it('marks the global V免签 channel configured without a PID', () => {
    const status = buildGlobalStatus({
      QIUPAY_BASE_URL: 'https://v.0st.top',
      QIUPAY_KEY: 'vmq-key',
      QIUPAY_PID: '',
    });

    expect(status.qiupay.configured).toBe(true);
  });
});
