import crypto from 'node:crypto';
import { AppError, ErrorCode } from '../utils/errors';
const PLATFORM_HOSTS = {
    bilibili: ['bilibili.com', 'www.bilibili.com', 'm.bilibili.com', 'b23.tv'],
    douyin: ['douyin.com', 'www.douyin.com', 'v.douyin.com'],
    kuaishou: ['kuaishou.com', 'www.kuaishou.com', 'v.kuaishou.com'],
    xiaohongshu: ['xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com'],
    weibo: ['weibo.com', 'www.weibo.com', 'm.weibo.cn'],
};
const PLATFORM_VIDEO_PATTERNS = {
    bilibili: [/\/video\/(BV[A-Za-z0-9]+)/i, /\/video\/av(\d+)/i],
    douyin: [/\/video\/(\d+)/i],
    kuaishou: [/\/short-video\/([A-Za-z0-9_-]+)/i],
    xiaohongshu: [/\/(?:explore|discovery\/item)\/([A-Za-z0-9_-]+)/i],
    weibo: [/\/status\/([A-Za-z0-9_-]+)/i, /\/tv\/show\/([A-Za-z0-9:_-]+)/i],
};
const normalizePlatform = (platform) => platform.trim().toLowerCase();
export const parsePromoVideoUrl = (platformInput, rawUrl) => {
    const platform = normalizePlatform(platformInput);
    const allowedHosts = PLATFORM_HOSTS[platform];
    if (!allowedHosts)
        throw new AppError('Unsupported promotion platform', 400, ErrorCode.VALIDATION_ERROR);
    let url;
    try {
        url = new URL(rawUrl.trim());
    }
    catch {
        throw new AppError('Video URL is invalid', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts.includes(url.hostname.toLowerCase())) {
        throw new AppError('Video URL does not belong to the selected platform', 400, ErrorCode.VALIDATION_ERROR);
    }
    url.hash = '';
    const normalizedUrl = url.toString();
    const patterns = PLATFORM_VIDEO_PATTERNS[platform] ?? [];
    const extracted = patterns.map((pattern) => normalizedUrl.match(pattern)?.[1]).find(Boolean);
    const videoId = extracted || `url_${crypto.createHash('sha256').update(normalizedUrl).digest('hex').slice(0, 32)}`;
    return { platform, normalizedUrl, videoId, host: url.hostname.toLowerCase() };
};
export const getPromoPlatformHosts = (platform) => (PLATFORM_HOSTS[normalizePlatform(platform)] ?? []);
//# sourceMappingURL=promoVideoUrlService.js.map