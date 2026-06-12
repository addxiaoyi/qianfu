import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redisService';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';

const SUSPICIOUS_AGENTS = [
  'bot', 'spider', 'crawler', 'scraper', 'python', 'curl', 'wget', 'httpclient',
  'axios', 'postman', 'insomnia', 'headless', 'puppeteer', 'selenium'
];

const AUTOMATION_BROWSER_AGENTS = [
  'headless',
  'puppeteer',
  'selenium',
];

const GOOD_BOTS = [
  'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'duckduckbot', 'slurp',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest/0.', 'developers.google.com/+/web/snippet',
  'slackbot', 'vkshare', 'w3c_validator', 'redditbot', 'applebot', 'whatsapp',
  'flipboard', 'tumblr', 'bitlybot', 'skypeuripreview', 'nuzzel', 'discordbot',
  'google page speed', 'qwantify', 'pinterest', 'wordpress', 'x-buffer'
];

const IP_BLACKLIST_PREFIX = 'anti-crawler:blacklist:';
const BLACKLIST_TTL = 24 * 60 * 60; // 24 hours in seconds

function rejectCrawler(res: Response, req: Request, message: string = 'Access denied') {
  return res.status(403).json(
    buildErrorEnvelope({
      message,
      code: 'ILLEGAL_REQUEST_BLOCKED',
      statusCode: 403,
      requestId: req.requestId,
    }),
  );
}

export const antiCrawler = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  const referer = String(req.headers['referer'] || '').toLowerCase();
  const host = String(req.headers['host'] || '').toLowerCase();
  const hasBrowserHints =
    typeof req.headers['sec-ch-ua'] !== 'undefined' ||
    typeof req.headers['sec-fetch-mode'] !== 'undefined' ||
    typeof req.headers['sec-fetch-site'] !== 'undefined';

  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
    return next();
  }

  const publicPathPrefixes = [
    '/health',
    '/api/ready',
    '/api/v1/ready',
    '/api/health',
    '/api/health/detailed',
    '/api/servers/stats',
    '/api/v1/servers/stats',
    '/api/csrf-token',
    '/api/v1/csrf-token',
    '/api/profile',
    '/api/v1/profile',
    '/api/auth/login',
    '/api/v1/auth/login',
    '/api/auth/csrf-token',
    '/api/v1/auth/csrf-token',
    '/api/auth/oauth-status',
    '/api/v1/auth/oauth-status',
    '/api/auth/github/start',
    '/api/v1/auth/github/start',
    '/api/auth/github/callback',
    '/api/v1/auth/github/callback',
    '/auth/csrf-token',
    '/api/v1/payment/xpay/notify',
    '/api/v1/payment/xpay/tenant-notify',
    '/api/v1/payment/paypro/notify',
    '/api/v1/payment/tpay/notify',
    '/api/v1/payment/hupijiao/notify',
    '/api/v1/payment/qiupay/notify',
    '/api/v1/payment/creem/webhook',
    '/api/v1/payment/creem/return',
    '/api/v1/payment/xpay-bridge/notify',
    '/api/v1/payment/personal-qr/notify',
    '/api/v1/qianfu/xpay/notify',
  ];

  if (publicPathPrefixes.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  const isBlacklisted = await redisService.get(IP_BLACKLIST_PREFIX + ip);
  if (isBlacklisted) {
    return rejectCrawler(res, req);
  }

  if (GOOD_BOTS.some(bot => userAgent.includes(bot))) {
    return next();
  }

  const suspiciousAgentReasons = SUSPICIOUS_AGENTS.filter(agent => userAgent.includes(agent));
  const suspiciousAgent = suspiciousAgentReasons.length > 0;
  const emptyUaOnApi = req.path.startsWith('/api') && userAgent.trim().length === 0;
  const suspiciousCrossSiteApi = req.path.startsWith('/api') && secFetchSite === 'cross-site';
  const missingBrowserHintsOnApi = req.path.startsWith('/api') && !hasBrowserHints;

  const sameOriginReferer =
    referer.length > 0 &&
    host.length > 0 &&
    (referer.includes(`://${host}/`) || referer.endsWith(`://${host}`) || referer.includes(`://${host}#`));
  const sameSiteBrowserFetch =
    req.path.startsWith('/api') &&
    hasBrowserHints &&
    !suspiciousCrossSiteApi &&
    (secFetchSite === '' || secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') &&
    sameOriginReferer;
  const allowedAutomationBrowser =
    suspiciousAgent &&
    suspiciousAgentReasons.every(agent => AUTOMATION_BROWSER_AGENTS.includes(agent));

  // Allow first-party browser automation sessions used for QA and embedded browser tooling.
  if (sameSiteBrowserFetch && allowedAutomationBrowser) {
    return next();
  }

  if (suspiciousAgent || emptyUaOnApi || suspiciousCrossSiteApi || missingBrowserHintsOnApi) {
    const hit = await redisService.incr(`anti-crawler:sus:${ip}`, 600);

    if (hit >= 12) {
      await redisService.set(IP_BLACKLIST_PREFIX + ip, 'true', BLACKLIST_TTL);
      return rejectCrawler(res, req);
    }

    return rejectCrawler(res, req);
  }

  if (req.path === '/admin/honeypot') {
    await redisService.set(IP_BLACKLIST_PREFIX + ip, 'true', BLACKLIST_TTL);
    return rejectCrawler(res, req);
  }

  next();
};

export const addToBlacklist = async (ip: string) => {
  await redisService.set(IP_BLACKLIST_PREFIX + ip, 'true', BLACKLIST_TTL);
};
