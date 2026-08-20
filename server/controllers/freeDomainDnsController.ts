import type { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import localPrisma from '../localDb';
import type { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { enqueueDnsDeleteTask, listFreeDomainDnsTasks, processFreeDomainTasks } from '../services/freeDomainDnsService';
import {
  getStoredDnsProviderConfig,
  maskDnsProviderConfig,
  saveStoredDnsProviderConfig,
  isCloudflareOauthConfigured,
} from '../services/freeDomainDnsProvider';
import { hasAuthorizedPermission, isAdministrativeRole } from '../utils/userPermissions';
import { redisService } from '../services/redisService';
import { revokeCloudflareOauth, saveCloudflareOauthToken } from '../services/freeDomainDnsProvider';

const suffixSchema = z.object({
  suffix: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]{3,253}$/),
  provider: z.enum(['CLOUDFLARE', 'ALIYUN']),
  enabled: z.boolean().default(true),
  prefix_pattern: z.string().trim().min(1).max(200),
  ttl: z.number().int().min(60).max(86400),
  quota_per_user: z.number().int().min(1).max(1000),
  reserved_words: z.array(z.string().trim().min(1).max(63)).max(200).default([
    'admin', 'api', 'www', 'mail', 'ftp', 'ns1', 'ns2', 'root', 'owner', 'support',
    'help', 'status', 'dashboard', 'login', 'register', 'auth', 'oauth', 'cloudflare',
    'alidns', 'dns', 'minecraft', 'mc', 'play', 'server', 'servers', 'store', 'shop',
    'blog', 'test', 'demo',
  ]),
  cloudflare_api_token: z.string().trim().max(500).optional(),
  cloudflare_zone_id: z.string().trim().max(200).optional(),
  aliyun_access_key_id: z.string().trim().max(200).optional(),
  aliyun_access_key_secret: z.string().trim().max(500).optional(),
  aliyun_region_id: z.string().trim().max(100).optional(),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const OAUTH_TTL_SECONDS = 600;
const oauthStateKey = (state: string) => `free-domain:cloudflare-oauth:${state}`;

function oauthRedirectUri(): string {
  return process.env.CLOUDFLARE_OAUTH_REDIRECT_URI?.trim() || 'https://mc-u.top/api/v1/admin/free-domain-dns/oauth/cloudflare/callback';
}

function oauthClientId(): string {
  const value = process.env.CLOUDFLARE_OAUTH_CLIENT_ID?.trim();
  if (!value) throw new AppError('Cloudflare OAuth 尚未配置 Client ID', 503, ErrorCode.SERVICE_UNAVAILABLE);
  return value;
}

export async function startCloudflareOauth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const suffixId = idSchema.parse(req.params).id;
    const suffix = await localPrisma.freeDomainSuffix.findUnique({ where: { id: suffixId } });
    if (!suffix || suffix.provider !== 'CLOUDFLARE') throw new AppError('该后缀未绑定 Cloudflare', 400, ErrorCode.VALIDATION_ERROR);
    const state = randomBytes(32).toString('base64url');
    await redisService.set(oauthStateKey(state), { userId: req.user!.id, suffixId }, OAUTH_TTL_SECONDS);
    const params = new URLSearchParams({ response_type: 'code', client_id: oauthClientId(), redirect_uri: oauthRedirectUri(), state });
    return res.redirect(`https://dash.cloudflare.com/oauth2/auth?${params}`);
  } catch (error) { return next(error); }
}

export async function cloudflareOauthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) throw new AppError('Cloudflare OAuth 回调参数无效', 400, ErrorCode.VALIDATION_ERROR);
    const pending = await redisService.get<{ userId: number; suffixId: number }>(oauthStateKey(state));
    if (!pending) throw new AppError('Cloudflare OAuth 状态已过期，请重新连接', 400, ErrorCode.VALIDATION_ERROR);
    await redisService.del(oauthStateKey(state));
    const secret = process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET?.trim();
    if (!secret) throw new AppError('Cloudflare OAuth 尚未配置 Client Secret', 503, ErrorCode.SERVICE_UNAVAILABLE);
    const response = await fetch(process.env.CLOUDFLARE_OAUTH_TOKEN_URL || 'https://api.cloudflare.com/client/v4/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: oauthClientId(), client_secret: secret, redirect_uri: oauthRedirectUri() }) });
    const payload = await response.json().catch(() => null) as { access_token?: string } | null;
    if (!response.ok || !payload?.access_token) throw new AppError('Cloudflare OAuth 授权失败', 502, ErrorCode.SERVICE_UNAVAILABLE);
    await saveCloudflareOauthToken(pending.suffixId, payload.access_token);
    return res.redirect('/admin-free-domains?oauth=success');
  } catch (error) { return next(error); }
}

export async function revokeCloudflareOauthController(req: AuthRequest, res: Response, next: NextFunction) {
  try { await revokeCloudflareOauth(idSchema.parse(req.params).id); return sendSuccess(res, { revoked: true }, 'Cloudflare OAuth 已解除'); }
  catch (error) { return next(error); }
}

export async function listFreeDomainSuffixes(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await localPrisma.freeDomainSuffix.findMany({ where: { enabled: true }, orderBy: { suffix: 'asc' } });
    return sendSuccess(res, rows.map((row: any) => ({
      id: row.id,
      suffix: row.suffix,
      provider: row.provider,
      ttl: row.ttl,
      quotaPerUser: row.quota_per_user,
    })), 'Free domain suffixes loaded');
  } catch (error) { return next(error); }
}

export async function listAdminFreeDomainSuffixes(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await localPrisma.freeDomainSuffix.findMany({ orderBy: { suffix: 'asc' } });
    const result = await Promise.all(rows.map(async (row: any) => {
      const providerConfig = await getStoredDnsProviderConfig(row.provider as 'CLOUDFLARE' | 'ALIYUN', row.id);
      return {
        ...row,
        reserved_words: JSON.parse(row.reserved_words || '[]'),
        providerConfig: maskDnsProviderConfig(providerConfig),
        credentialConfigured: providerConfig.configured,
        oauthConfigured: row.provider === 'CLOUDFLARE' ? await isCloudflareOauthConfigured(row.id) : false,
      };
    }));
    return sendSuccess(res, result);
  } catch (error) { return next(error); }
}

export async function upsertAdminFreeDomainSuffix(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = suffixSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('免费域名后缀配置无效', 400, ErrorCode.VALIDATION_ERROR, false, parsed.error.issues);
    const {
      cloudflare_api_token,
      cloudflare_zone_id,
      aliyun_access_key_id,
      aliyun_access_key_secret,
      aliyun_region_id,
      ...suffixData
    } = parsed.data;
    const data = { ...suffixData, reserved_words: JSON.stringify(suffixData.reserved_words) };
    const id = req.params.id ? idSchema.parse(req.params).id : undefined;
    const row = id
      ? await localPrisma.freeDomainSuffix.update({ where: { id }, data })
      : await localPrisma.freeDomainSuffix.create({ data });
    await saveStoredDnsProviderConfig(row.provider as 'CLOUDFLARE' | 'ALIYUN', row.id, {
      cloudflareApiToken: cloudflare_api_token,
      cloudflareZoneId: cloudflare_zone_id,
      aliyunAccessKeyId: aliyun_access_key_id,
      aliyunAccessKeySecret: aliyun_access_key_secret,
      aliyunRegionId: aliyun_region_id,
    });
    return sendSuccess(res, { id: row.id, suffix: row.suffix, provider: row.provider, enabled: row.enabled }, 'Free domain suffix saved');
  } catch (error) { return next(error); }
}

export async function getServerDomainStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    const serverId = idSchema.parse({ id: req.params.serverId }).id;
    const row = await localPrisma.serverDomain.findFirst({ where: { server_id: serverId, user_id: req.user.id }, include: { suffix: true, tasks: true, records: true } });
    return sendSuccess(res, row ? {
      domain: row.domain,
      prefix: row.prefix,
      suffix: row.suffix.suffix,
      provider: row.suffix.provider,
      applicationStatus: row.application_status,
      dnsStatus: row.dns_status,
      lastError: row.tasks.find((task: any) => task.status === 'FAILED')?.last_error ?? null,
    } : null, 'Domain status loaded');
  } catch (error) { return next(error); }
}

export async function retryDnsTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params).id;
    const task = await localPrisma.dnsTask.update({ where: { id }, data: { status: 'PENDING', next_attempt_at: new Date(), last_error: null, locked_at: null } });
    return sendSuccess(res, task, 'DNS task queued');
  } catch (error) { return next(error); }
}

export async function listAdminDnsTasks(_req: AuthRequest, res: Response, next: NextFunction) {
  try { return sendSuccess(res, await listFreeDomainDnsTasks()); }
  catch (error) { return next(error); }
}

export async function revokeServerDomain(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    const serverId = idSchema.parse({ id: req.params.serverId }).id;
    const domain = await localPrisma.serverDomain.findUnique({ where: { server_id: serverId } });
    const isAdmin = isAdministrativeRole(req.user.role) || hasAuthorizedPermission(req.user.role, req.user.permissions, 'manage_content');
    if (!domain || (domain.user_id !== req.user.id && !isAdmin)) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    await enqueueDnsDeleteTask(serverId);
    return sendSuccess(res, { serverId, status: 'REVOKE_PENDING' }, 'DNS revoke queued');
  } catch (error) { return next(error); }
}

export async function runDnsTasks(_req: AuthRequest, res: Response, next: NextFunction) {
  try { return sendSuccess(res, { processed: await processFreeDomainTasks() }, 'DNS tasks processed'); }
  catch (error) { return next(error); }
}
