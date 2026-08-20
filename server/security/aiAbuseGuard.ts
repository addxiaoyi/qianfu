import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { buildErrorEnvelope } from '../contracts/responseEnvelope.js';

const ZERO_WIDTH = /[\u200B-\u200F\u2060\uFEFF]/g;
const ALLOWED_ORIGINS = new Set([(process.env.APP_URL || 'https://mc-u.top'), 'https://www.mc-u.top']);
const WEB_CLIENT_HEADER = 'x-qianfu-ai-client';

const RULES: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: 'PROMPT_OVERRIDE', pattern: /(ignore|disregard|forget|override).{0,32}(instruction|prompt|rule|policy)|忽略.{0,16}(指令|规则|提示)|忘记.{0,16}(规则|设定)|覆盖.{0,12}(系统|指令)/i },
  { code: 'PROMPT_EXTRACTION', pattern: /(system|developer|hidden|initial).{0,24}(prompt|message|instruction)|系统提示词|开发者消息|初始提示|隐藏指令|内部规则|复述.{0,12}提示词/i },
  { code: 'PROMPT_DISTILLATION', pattern: /(distill|extract|reconstruct|reverse.engineer|summari[sz]e).{0,30}(prompt|policy|instruction)|蒸馏.{0,12}(提示词|系统)|还原.{0,12}(提示词|指令)|逆向.{0,12}(提示词|规则)|套出.{0,12}(提示词|设定)/i },
  { code: 'ROLEPLAY_BYPASS', pattern: /(you are now|new persona|developer mode|dan mode|role.?play).{0,40}|现在你是|进入.{0,8}(开发者|无限制|越狱)模式|扮演.{0,16}(无视|不受|没有规则)/i },
  { code: 'SOURCE_PROBE', pattern: /(source code|repository|repo|environment variable|api.?key|secret|stack trace|database schema)|源码|源代码|仓库地址|环境变量|密钥|数据库结构|技术栈.{0,8}(细节|实现)|具体实现方法/i },
  { code: 'PROXY_ABUSE', pattern: /(reverse proxy|relay|resell|api proxy|token forwarding|credential sharing)|反代.{0,16}(ai|模型|接口|提示词)|中转.{0,16}(接口|模型)|转售.{0,12}(额度|接口)|共享.{0,12}(密钥|key)|套壳.{0,12}(接口|模型)/i },
  { code: 'OBFUSCATION', pattern: /(base64|rot13|unicode escape|zero.?width|homoglyph|leet.?speak).{0,32}(prompt|instruction|bypass|decode)|零宽字符|同形字|火星文|黑话.{0,12}(绕过|提示词)|编码.{0,12}(绕过|解码指令)/i },
  { code: 'ABUSE_INTENT', pattern: /(bypass|jailbreak|evade|exploit).{0,24}(guard|filter|moderation|limit)|绕过.{0,16}(审核|限制|风控|过滤)|越狱|爆破.{0,12}(接口|额度|提示词)/i },
];

export type AiGuardResult = { blocked: false } | { blocked: true; code: string };

export function normalizeAiInput(value: string): string {
  return value
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(/[\s._\-/\\|]+/g, ' ')
    .replace(/0/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .toLowerCase();
}

export function inspectAiInput(value: string): AiGuardResult {
  const normalized = normalizeAiInput(value);
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) return { blocked: true, code: rule.code };
  }
  return { blocked: false };
}

export function containsSensitiveAiOutput(value: string): boolean {
  const normalized = normalizeAiInput(value);
  return /(ai api key|zhipu api key|nvidia api key|authorization: bearer|begin system prompt|developer message:|process env|系统提示词[:：]|开发者消息[:：]|数据库连接串|私钥)/i.test(normalized);
}

export function aiWebOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next();
  const origin = req.get('origin') || '';
  const fetchSite = req.get('sec-fetch-site') || '';
  const client = req.get(WEB_CLIENT_HEADER) || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin);
  const allowedSite = !fetchSite || fetchSite === 'same-origin';
  if (allowedOrigin && allowedSite && client === 'qianfu-web-v1') return next();

  logger.security('Blocked non-web AI relay attempt', {
    ip: req.ip,
    origin: origin.slice(0, 160),
    fetchSite: fetchSite.slice(0, 40),
    requestId: req.requestId,
  });
  return res.status(403).json(buildErrorEnvelope({
    message: 'AI assistant is only available from the QianFu website',
    code: 'AI_WEB_CLIENT_REQUIRED',
    statusCode: 403,
    requestId: req.requestId,
  }));
}

export function auditBlockedAiInput(req: Request, code: string) {
  const message = String(req.body?.message || '');
  logger.security('Blocked malicious AI inquiry', {
    code,
    inputHash: createHash('sha256').update(message).digest('hex').slice(0, 20),
    inputLength: message.length,
    ip: req.ip,
    userId: req.user?.id,
    requestId: req.requestId,
  });
}
