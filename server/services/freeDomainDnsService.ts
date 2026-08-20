import type { Prisma } from '../db';
import localPrisma from '../localDb';
import { AppError, ErrorCode } from '../utils/errors';
import {
  buildDnsRecordInputs,
  isDnsTarget,
  normalizeFreeDomainRequest,
  type FreeDomainSuffixPolicy,
} from './freeDomainDnsPolicy';
import { executeDnsTask, type DnsTaskExecution } from './freeDomainDnsTask';
import { getDnsProvider } from './freeDomainDnsProvider';

const DEFAULT_MINECRAFT_PORT = 25565;
const DOMAIN_NOT_REQUESTED = 'NOT_REQUESTED';

type DomainFields = {
  free_domain_enabled?: boolean;
  free_domain_suffix_id?: number;
  free_domain_prefix?: string;
};

function asPolicy(value: any): FreeDomainSuffixPolicy {
  return {
    id: value.id,
    suffix: value.suffix,
    enabled: value.enabled,
    prefixPattern: value.prefix_pattern,
    reservedWords: JSON.parse(value.reserved_words || '[]'),
    ttl: value.ttl,
    quotaPerUser: value.quota_per_user,
  };
}

export async function createServerDomainApplication(
  tx: Prisma.TransactionClient,
  input: DomainFields,
  values: { serverId: number; userId: number; target: string; port?: number },
): Promise<void> {
  if (!input.free_domain_enabled) return;
  if (!input.free_domain_suffix_id || !input.free_domain_prefix) {
    throw new AppError('免费域名信息不完整', 400, ErrorCode.VALIDATION_ERROR);
  }
  const target = values.target.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!isDnsTarget(target)) {
    throw new AppError('目标地址不支持 DNS 解析', 400, ErrorCode.VALIDATION_ERROR);
  }

  const suffix = await tx.freeDomainSuffix.findUnique({ where: { id: input.free_domain_suffix_id } });
  if (!suffix) throw new AppError('免费域名后缀不存在', 400, ErrorCode.VALIDATION_ERROR);
  const normalized = normalizeFreeDomainRequest({ suffix: asPolicy(suffix), prefix: input.free_domain_prefix });
  const used = await tx.serverDomain.count({
    where: { user_id: values.userId, application_status: { not: 'REJECTED' } },
  });
  if (used >= suffix.quota_per_user) {
    throw new AppError('免费域名配额已用尽', 403, ErrorCode.FORBIDDEN);
  }

  await tx.serverDomain.create({
    data: {
      server_id: values.serverId,
      user_id: values.userId,
      suffix_id: suffix.id,
      prefix: normalized.prefix,
      domain: normalized.domain,
      target,
      port: values.port ?? DEFAULT_MINECRAFT_PORT,
      application_status: 'PENDING_REVIEW',
      dns_status: DOMAIN_NOT_REQUESTED,
    },
  });
}

export async function enqueueDnsApplyTask(
  tx: Prisma.TransactionClient,
  serverId: number,
): Promise<void> {
  const domain = await tx.serverDomain.findUnique({ where: { server_id: serverId } });
  if (!domain) return;
  await tx.serverDomain.update({
    where: { id: domain.id },
    data: { application_status: 'APPROVED', dns_status: 'PENDING', reviewed_at: new Date() },
  });
  await tx.dnsTask.upsert({
    where: { server_domain_id_action: { server_domain_id: domain.id, action: 'APPLY' } },
    create: { server_domain_id: domain.id, action: 'APPLY', status: 'PENDING' },
    update: { status: 'PENDING', next_attempt_at: new Date(), last_error: null },
  });
}

export async function updateServerDomainApplication(
  tx: Prisma.TransactionClient,
  input: DomainFields,
  values: { serverId: number; userId: number; target: string; port?: number },
): Promise<void> {
  const current = await tx.serverDomain.findUnique({ where: { server_id: values.serverId }, include: { records: true } });
  if (!input.free_domain_enabled) {
    if (!current) return;
    await tx.serverDomain.update({ where: { id: current.id }, data: { application_status: 'REVOKED', dns_status: 'REVOKE_PENDING' } });
    await tx.dnsTask.upsert({
      where: { server_domain_id_action: { server_domain_id: current.id, action: 'DELETE' } },
      create: { server_domain_id: current.id, action: 'DELETE', status: 'PENDING' },
      update: { status: 'PENDING', next_attempt_at: new Date(), last_error: null, locked_at: null },
    });
    return;
  }

  if (!current) {
    await createServerDomainApplication(tx, input, values);
    return;
  }

  const target = values.target.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!isDnsTarget(target)) throw new AppError('目标地址不支持 DNS 解析', 400, ErrorCode.VALIDATION_ERROR);
  if (!input.free_domain_suffix_id || !input.free_domain_prefix) {
    throw new AppError('免费域名信息不完整', 400, ErrorCode.VALIDATION_ERROR);
  }
  const suffix = await tx.freeDomainSuffix.findUnique({ where: { id: input.free_domain_suffix_id } });
  if (!suffix) throw new AppError('免费域名后缀不存在', 400, ErrorCode.VALIDATION_ERROR);
  const normalized = normalizeFreeDomainRequest({ suffix: asPolicy(suffix), prefix: input.free_domain_prefix });
  const domainChanged = current.domain !== normalized.domain;
  await tx.serverDomain.update({ where: { id: current.id }, data: {
    suffix_id: suffix.id,
    prefix: normalized.prefix,
    domain: normalized.domain,
    target,
    port: values.port ?? DEFAULT_MINECRAFT_PORT,
    application_status: 'PENDING_REVIEW',
    dns_status: 'PENDING',
    reviewed_at: null,
  } });
  if (domainChanged && current.records.length > 0) {
    await tx.dnsTask.upsert({
      where: { server_domain_id_action: { server_domain_id: current.id, action: 'DELETE' } },
      create: { server_domain_id: current.id, action: 'DELETE', status: 'PENDING' },
      update: { status: 'PENDING', next_attempt_at: new Date(), last_error: null, locked_at: null },
    });
  }
  await tx.dnsTask.upsert({
    where: { server_domain_id_action: { server_domain_id: current.id, action: 'APPLY' } },
    create: { server_domain_id: current.id, action: 'APPLY', status: 'PENDING' },
    update: { status: 'PENDING', next_attempt_at: new Date(), last_error: null, locked_at: null },
  });
}

export async function enqueueDnsDeleteTask(serverId: number): Promise<void> {
  await localPrisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const domain = await tx.serverDomain.findUnique({ where: { server_id: serverId } });
    if (!domain) return;
    await tx.serverDomain.update({ where: { id: domain.id }, data: { dns_status: 'REVOKE_PENDING' } });
    await tx.dnsTask.updateMany({
      where: { server_domain_id: domain.id, action: 'APPLY', status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
      data: { status: 'CANCELED', locked_at: null },
    });
    await tx.dnsTask.upsert({
      where: { server_domain_id_action: { server_domain_id: domain.id, action: 'DELETE' } },
      create: { server_domain_id: domain.id, action: 'DELETE', status: 'PENDING' },
      update: { status: 'PENDING', next_attempt_at: new Date(), last_error: null },
    });
  });
}

function toTask(value: any): DnsTaskExecution {
  const records = (value.records ?? []).map((record: any) => ({
    type: record.record_type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    providerRecordId: record.provider_record_id,
  }));
  return {
    id: value.id,
    action: value.action,
    domain: value.server_domain.domain,
    target: value.server_domain.target,
    port: value.server_domain.port,
    ttl: value.server_domain.suffix.ttl,
    records,
  };
}

function repositoryFor(_task: any) {
  return {
    async saveRecord(taskId: number, input: any, providerRecordId: string) {
      const row = await localPrisma.dnsTask.findUnique({ where: { id: taskId } });
      if (!row) throw new Error('DNS task disappeared');
      await localPrisma.dnsRecord.upsert({
        where: { server_domain_id_record_type_name_content: {
          server_domain_id: row.server_domain_id,
          record_type: input.type,
          name: input.name,
          content: input.content,
        } },
        create: {
          server_domain_id: row.server_domain_id,
          record_type: input.type,
          name: input.name,
          content: input.content,
          ttl: input.ttl,
          provider_record_id: providerRecordId,
          status: 'ACTIVE',
        },
        update: { provider_record_id: providerRecordId, status: 'ACTIVE', last_error: null },
      });
    },
    async markCompleted(taskId: number) {
      const task = await localPrisma.dnsTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', locked_at: null } });
      if (task.action === 'DELETE') {
        await localPrisma.dnsRecord.updateMany({ where: { server_domain_id: task.server_domain_id, created_by_platform: true }, data: { status: 'REVOKED' } });
        const applyTask = await localPrisma.dnsTask.findUnique({ where: { server_domain_id_action: { server_domain_id: task.server_domain_id, action: 'APPLY' } } });
        if (applyTask?.status === 'PENDING' || applyTask?.status === 'PROCESSING') return;
      }
      await localPrisma.serverDomain.update({
        where: { id: task.server_domain_id },
        data: { dns_status: task.action === 'DELETE' ? 'REVOKED' : 'ACTIVE' },
      });
    },
    async markFailed(taskId: number, message: string, retryAt: Date) {
      const task = await localPrisma.dnsTask.update({
        where: { id: taskId },
        data: { status: 'FAILED', attempts: { increment: 1 }, next_attempt_at: retryAt, last_error: message, locked_at: null },
      });
      await localPrisma.serverDomain.update({ where: { id: task.server_domain_id }, data: { dns_status: 'FAILED' } });
    },
  };
}

export async function processFreeDomainTasks(limit = 10): Promise<number> {
  const tasks = await localPrisma.dnsTask.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, next_attempt_at: { lte: new Date() } },
    orderBy: { next_attempt_at: 'asc' },
    take: limit,
    include: { server_domain: { include: { suffix: true, records: true } } },
  });
  let processed = 0;
  for (const task of tasks) {
    const locked = await localPrisma.dnsTask.updateMany({
      where: { id: task.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', locked_at: new Date() },
    });
    if (!locked.count) continue;
    try {
      const provider = await getDnsProvider(
        task.server_domain.suffix.provider as 'CLOUDFLARE' | 'ALIYUN',
        task.server_domain.suffix.suffix,
        task.server_domain.suffix_id,
      );
      await executeDnsTask(toTask(task), { provider, repository: repositoryFor(task) });
    } catch (error) {
      await localPrisma.dnsTask.update({ where: { id: task.id }, data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        next_attempt_at: new Date(Date.now() + 60_000),
        last_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        locked_at: null,
      } });
      await localPrisma.serverDomain.update({ where: { id: task.server_domain_id }, data: { dns_status: 'FAILED' } });
    }
    processed += 1;
  }
  return processed;
}

export async function listFreeDomainDnsTasks(limit = 100) {
  return localPrisma.dnsTask.findMany({
    take: limit,
    orderBy: { updated_at: 'desc' },
    include: { server_domain: { select: { domain: true, target: true, application_status: true, dns_status: true } } },
  });
}

export function desiredDnsRecords(domain: { domain: string; target: string; port: number; ttl: number }) {
  return buildDnsRecordInputs(domain);
}
