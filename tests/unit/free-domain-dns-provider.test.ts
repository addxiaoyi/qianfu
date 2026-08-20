import { describe, expect, it, vi } from 'vitest';
import {
  getDnsProviderConfig,
  getStoredDnsProviderConfig,
  maskDnsProviderConfig,
  providerConfigKeys,
  saveStoredDnsProviderConfig,
} from '../../server/services/freeDomainDnsProvider';

const { getConfigMock, setConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(async (key: string) => ({
    'FREE_DOMAIN_DNS_SUFFIX_7_CLOUDFLARE_API_TOKEN': 'stored-token',
    'FREE_DOMAIN_DNS_SUFFIX_7_CLOUDFLARE_ZONE_ID': 'stored-zone',
  })[key] ?? null),
  setConfigMock: vi.fn(),
}));

vi.mock('../../server/services/configService', () => ({
  getConfig: getConfigMock,
  setConfig: setConfigMock,
}));

describe('free domain DNS provider configuration', () => {
  it('uses suffix-scoped encrypted configuration keys', () => {
    expect(providerConfigKeys('CLOUDFLARE', 7)).toEqual({
      token: 'FREE_DOMAIN_DNS_SUFFIX_7_CLOUDFLARE_API_TOKEN',
      zoneId: 'FREE_DOMAIN_DNS_SUFFIX_7_CLOUDFLARE_ZONE_ID',
    });
  });

  it('loads stored credentials without exposing them in the masked response', async () => {
    const config = await getStoredDnsProviderConfig('CLOUDFLARE', 7);
    expect(config).toMatchObject({ configured: true, token: 'stored-token', zoneId: 'stored-zone' });
    expect(maskDnsProviderConfig(config)).toEqual({ provider: 'CLOUDFLARE', credentialConfigured: true });
    expect(JSON.stringify(maskDnsProviderConfig(config))).not.toContain('stored-token');
  });

  it('saves administrator credentials as secret configuration values', async () => {
    await saveStoredDnsProviderConfig('ALIYUN', 9, {
      aliyunAccessKeyId: 'akid',
      aliyunAccessKeySecret: 'aksecret',
      aliyunRegionId: 'cn-hangzhou',
    });

    expect(setConfigMock).toHaveBeenCalledWith(
      'FREE_DOMAIN_DNS_SUFFIX_9_ALIYUN_ACCESS_KEY_SECRET',
      'aksecret',
      true,
      'Alibaba Cloud DNS AccessKey secret',
    );
  });

  it('reads credentials from environment and exposes only configuration status', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: 'cf-secret',
      CLOUDFLARE_ZONE_ID: 'zone-1',
    };

    const config = getDnsProviderConfig('CLOUDFLARE', env);
    expect(config).toMatchObject({ provider: 'CLOUDFLARE', configured: true, zoneId: 'zone-1' });
    expect(config.token).toBe('cf-secret');
    expect(maskDnsProviderConfig(config)).toEqual({ provider: 'CLOUDFLARE', credentialConfigured: true });
    expect(JSON.stringify(maskDnsProviderConfig(config))).not.toContain('secret');
  });

  it('does not treat incomplete Alibaba credentials as configured', () => {
    expect(getDnsProviderConfig('ALIYUN', {
      ALIYUN_ACCESS_KEY_ID: 'akid',
    })).toMatchObject({ provider: 'ALIYUN', configured: false });
  });
});
