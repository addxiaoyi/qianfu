import { describe, expect, it, vi } from 'vitest';
import { executeDnsTask, type DnsTaskExecution } from '../../server/services/freeDomainDnsTask';

const task: DnsTaskExecution = {
  id: 21,
  action: 'APPLY',
  domain: 'play.example.com',
  target: '203.0.113.10',
  port: 25570,
  ttl: 300,
  records: [{ type: 'A', name: 'play.example.com', content: '203.0.113.10', providerRecordId: 'cf-a-1' }],
};

describe('free domain DNS task execution', () => {
  it('does not recreate records already owned by the platform', async () => {
    const provider = {
      ensureRecord: vi.fn().mockResolvedValue({ recordId: 'cf-srv-1' }),
      deleteRecord: vi.fn(),
    };
    const repository = {
      saveRecord: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };

    await executeDnsTask(task, { provider, repository });

    expect(provider.ensureRecord).toHaveBeenCalledTimes(1);
    expect(provider.ensureRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SRV',
      name: '_minecraft._tcp.play.example.com',
      idempotencyKey: 'dns-task:21:SRV:_minecraft._tcp.play.example.com',
    }));
    expect(repository.markCompleted).toHaveBeenCalledWith(21);
  });

  it('marks provider failures retryable without exposing credentials', async () => {
    const provider = {
      ensureRecord: vi.fn().mockRejectedValue(new Error('token=secret-value upstream timeout')),
      deleteRecord: vi.fn(),
    };
    const repository = {
      saveRecord: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };

    await executeDnsTask({ ...task, records: [] }, { provider, repository });

    expect(repository.markFailed).toHaveBeenCalledWith(
      21,
      expect.not.stringContaining('secret-value'),
      expect.any(Date),
    );
    expect(repository.markCompleted).not.toHaveBeenCalled();
  });
});
