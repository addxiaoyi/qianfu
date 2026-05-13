import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redisService';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';

const SUSPICIOUS_AGENTS = [
  'bot', 'spider', 'crawler', 'scraper', 'python', 'curl', 'wget', 'httpclient',
  'axios', 'postman', 'insomnia', 'headless', 'puppeteer', 'selenium'
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
  const hasBrowserHints =
    typeof req.headers['sec-ch-ua'] !== 'undefined' ||
    typeof req.headers['sec-fetch-mode'] !== 'undefined' ||
    typeof req.headers['sec-fetch-site'] !== 'undefined';

  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
    return next();
  }

  const isBlacklisted = await redisService.get(IP_BLACKLIST_PREFIX + ip);
  if (isBlacklisted) {
    return rejectCrawler(res, req);
  }

  if (GOOD_BOTS.some(bot => userAgent.includes(bot))) {
    return next();
  }

  const suspiciousAgent = SUSPICIOUS_AGENTS.some(agent => userAgent.includes(agent));
  const emptyUaOnApi = req.path.startsWith('/api') && userAgent.trim().length === 0;
  const suspiciousCrossSiteApi = req.path.startsWith('/api') && secFetchSite === 'cross-site';
  const missingBrowserHintsOnApi = req.path.startsWith('/api') && !hasBrowserHints;

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
