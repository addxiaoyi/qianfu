import crypto from 'node:crypto';

import { env } from '../config/env';
import { AppError, ErrorCode } from '../utils/errors';

const PLATFORM_HOSTS: Record<string, readonly string[]> = {
  bilibili: ['bilibili.com', 'www.bilibili.com', 'space.bilibili.com', 'm.bilibili.com'],
  douyin: ['douyin.com', 'www.douyin.com', 'v.douyin.com'],
  kuaishou: ['kuaishou.com', 'www.kuaishou.com', 'v.kuaishou.com'],
  xiaohongshu: ['xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com'],
  weibo: ['weibo.com', 'www.weibo.com', 'weibo.cn', 'm.weibo.cn'],
};

const PLATFORM_CODES: Record<string, string> = {
  bilibili: 'BILI',
  douyin: 'DOUYIN',
  kuaishou: 'KUAISHOU',
  xiaohongshu: 'XHS',
  weibo: 'WEIBO',
};

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

export interface PromoBindingRecord {
  id: number;
  user_id: number;
  platform: string;
  platform_user_id: string;
  platform_username?: string | null;
  binding_status: string;
  bind_source?: string;
  verified_at?: Date | null;
  last_verify_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface PromoBindingVerificationDb {
  promoPlatformBinding: {
    findFirst(args: unknown): Promise<PromoBindingRecord | null>;
    update(args: unknown): Promise<PromoBindingRecord>;
  };
}

const getChallengeSecret = (): string => {
  const secret = process.env.PROMO_BINDING_VERIFICATION_SECRET || env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError('平台绑定验证服务未配置', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }
  return secret;
};

export const buildPromoBindingChallenge = (
  binding: Pick<PromoBindingRecord, 'id' | 'user_id' | 'platform' | 'platform_user_id'>,
  secret = getChallengeSecret(),
): string => {
  const platform = binding.platform.trim().toLowerCase();
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`promo-binding:v1:${binding.id}:${binding.user_id}:${platform}:${binding.platform_user_id}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `STARX-${PLATFORM_CODES[platform] || 'ACCOUNT'}-${digest}`;
};

export const decoratePromoBinding = <T extends PromoBindingRecord>(binding: T) => ({
  ...binding,
  binding_status: binding.verified_at ? 'VERIFIED' : binding.binding_status === 'REJECTED' ? 'REJECTED' : 'PENDING',
  verification_code: buildPromoBindingChallenge(binding),
  verification_method: 'PUBLIC_PROFILE_CODE',
});

export const validatePromoProofUrl = (platformInput: string, rawUrl: string): URL => {
  const platform = platformInput.trim().toLowerCase();
  const allowedHosts = PLATFORM_HOSTS[platform];
  if (!allowedHosts) {
    throw new AppError('不支持该平台的自动检测', 400, ErrorCode.VALIDATION_ERROR);
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new AppError('证明链接格式不正确', 400, ErrorCode.VALIDATION_ERROR);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.port && url.port !== '443')
    || !allowedHosts.includes(hostname)
  ) {
    throw new AppError('证明链接必须是所选平台的公开 HTTPS 页面', 400, ErrorCode.VALIDATION_ERROR);
  }
  return url;
};

const readLimitedText = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new AppError('公开页面内容过大，无法自动检测', 422, ErrorCode.UNPROCESSABLE_ENTITY);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AppError('公开页面内容过大，无法自动检测', 422, ErrorCode.UNPROCESSABLE_ENTITY);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const fetchProofPage = async (
  platform: string,
  inputUrl: string,
  fetchImpl: typeof fetch,
): Promise<string> => {
  let current = validatePromoProofUrl(platform, inputUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/json;q=0.9,text/plain;q=0.8',
          'user-agent': 'STAR-X-PromoBindingVerifier/1.0',
        },
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? '公开页面访问超时'
        : '公开页面暂时无法访问';
      throw new AppError(message, 422, ErrorCode.UNPROCESSABLE_ENTITY);
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new AppError('公开页面重定向异常', 422, ErrorCode.UNPROCESSABLE_ENTITY);
      }
      current = validatePromoProofUrl(platform, new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new AppError(`平台返回 HTTP ${response.status}，暂时无法自动检测`, 422, ErrorCode.UNPROCESSABLE_ENTITY);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.includes('text/') && !contentType.includes('json') && !contentType.includes('javascript')) {
      throw new AppError('证明链接不是可检测的公开文本页面', 422, ErrorCode.UNPROCESSABLE_ENTITY);
    }
    return readLimitedText(response);
  }

  throw new AppError('公开页面重定向次数过多', 422, ErrorCode.UNPROCESSABLE_ENTITY);
};

export const verifyPromoPlatformBinding = async (
  db: PromoBindingVerificationDb,
  userId: number,
  bindingId: number,
  proofUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PromoBindingRecord> => {
  const binding = await db.promoPlatformBinding.findFirst({
    where: { id: bindingId, user_id: userId },
  });
  if (!binding) {
    throw new AppError('平台绑定不存在', 404, ErrorCode.NOT_FOUND);
  }

  const challenge = buildPromoBindingChallenge(binding);
  const checkedAt = new Date();
  let pageText: string;
  try {
    pageText = await fetchProofPage(binding.platform, proofUrl, fetchImpl);
  } catch (error) {
    await db.promoPlatformBinding.update({
      where: { id: binding.id },
      data: { binding_status: 'PENDING', last_verify_at: checkedAt },
    });
    throw error;
  }

  const detected = pageText.toUpperCase().includes(challenge.toUpperCase());
  if (!detected) {
    await db.promoPlatformBinding.update({
      where: { id: binding.id },
      data: { binding_status: 'PENDING', last_verify_at: checkedAt },
    });
    throw new AppError('公开页面中未检测到验证码，请保存公开内容后重试', 422, ErrorCode.UNPROCESSABLE_ENTITY);
  }

  return db.promoPlatformBinding.update({
    where: { id: binding.id },
    data: {
      binding_status: 'VERIFIED',
      bind_source: 'PUBLIC_PROFILE_CODE',
      verified_at: checkedAt,
      last_verify_at: checkedAt,
    },
  });
};
