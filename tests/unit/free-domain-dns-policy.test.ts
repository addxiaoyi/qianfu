import { describe, expect, it } from 'vitest';
import {
  buildDnsRecordInputs,
  normalizeFreeDomainRequest,
  validateFreeDomainRequest,
  type FreeDomainSuffixPolicy,
} from '../../server/services/freeDomainDnsPolicy';

const suffix: FreeDomainSuffixPolicy = {
  id: 7,
  suffix: 'example.com',
  enabled: true,
  prefixPattern: '^[a-z][a-z0-9-]{2,15}$',
  reservedWords: ['admin', 'www'],
  ttl: 300,
  quotaPerUser: 2,
};

describe('free domain DNS policy', () => {
  it('normalizes a valid prefix and produces the complete domain', () => {
    expect(normalizeFreeDomainRequest({ suffix, prefix: '  My-Server ' })).toEqual({
      prefix: 'my-server',
      domain: 'my-server.example.com',
    });
  });

  it('rejects disabled suffixes, reserved words and invalid prefixes', () => {
    expect(() => validateFreeDomainRequest({ ...suffix, enabled: false }, 'survival')).toThrow('后缀已停用');
    expect(() => validateFreeDomainRequest(suffix, 'admin')).toThrow('前缀不可用');
    expect(() => validateFreeDomainRequest(suffix, 'bad_prefix')).toThrow('前缀格式不正确');
  });

  it('maps IP and hostname targets to Minecraft DNS records', () => {
    expect(buildDnsRecordInputs({
      domain: 'play.example.com',
      target: '203.0.113.10',
      port: 25565,
      ttl: 300,
    })).toEqual([
      { type: 'A', name: 'play.example.com', content: '203.0.113.10', ttl: 300 },
    ]);

    expect(buildDnsRecordInputs({
      domain: 'play.example.com',
      target: '2001:db8::10',
      port: 25570,
      ttl: 600,
    })).toEqual([
      { type: 'AAAA', name: 'play.example.com', content: '2001:db8::10', ttl: 600 },
      { type: 'SRV', name: '_minecraft._tcp.play.example.com', content: '0 0 25570 play.example.com', ttl: 600 },
    ]);

    expect(buildDnsRecordInputs({
      domain: 'play.example.com',
      target: 'origin.example.net',
      port: 25565,
      ttl: 300,
    })).toEqual([
      { type: 'CNAME', name: 'play.example.com', content: 'origin.example.net', ttl: 300 },
    ]);
  });
});
