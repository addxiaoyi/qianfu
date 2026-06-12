import { sendSuccess } from '../utils/response.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { aiChatSchema } from '../utils/validation.js';
import { redisService } from '../services/redisService.js';
import { logger } from '../utils/logger.js';
import { buildFullAiSystemPrompt } from '../config/aiProductKnowledge.js';
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const JAILBREAK_KEYWORDS = [
    'ignore previous instructions',
    'disregard all instructions',
    'system prompt',
    'reveal instructions',
    'jailbreak',
    'you are now',
    'new persona',
    '忽略上面的指令',
    '忽略之前的指令',
    '忘记之前的规则',
    '现在你是',
    '扮演一个',
    '新的身份'
];
const getLanguage = (req) => {
    const bodyLang = req.body?.language;
    if (bodyLang === 'en' || bodyLang === 'zh')
        return bodyLang;
    return 'zh';
};
const checkRateLimit = async (userId, ip, today) => {
    if (userId) {
        const dailyLimitKey = `ai:daily:${userId}:${today}`;
        const dailyCount = await redisService.incr(dailyLimitKey, 24 * 60 * 60);
        if (dailyCount > 100)
            throw new AppError('Daily AI limit reached (100/day)', 429, ErrorCode.LIMIT_EXCEEDED);
    }
    else {
        const guestLimitKey = `ai:daily:guest:${ip}:${today}`;
        const guestCount = await redisService.incr(guestLimitKey, 24 * 60 * 60);
        if (guestCount > 20)
            throw new AppError('Guest limit reached (20/day)', 429, ErrorCode.LIMIT_EXCEEDED);
    }
};
const detectJailbreak = (message, userId, language, res) => {
    const lowerMessage = message.toLowerCase();
    if (JAILBREAK_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
        logger.warn(`[AI Chat] Potential jailbreak attempt by user ${userId}: ${message}`);
        return sendSuccess(res, {
            reply: language === 'en'
                ? "I'm sorry, I cannot fulfill this request. How can I help you with MotiaCraft today?"
                : "抱歉，我无法执行此操作。今天有什么关于 MotiaCraft 的问题可以帮到您？"
        });
    }
    return null;
};
const callZhipuAPI = async (messages, language) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(ZHIPU_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZHIPU_API_KEY}`
            },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            if (response.status === 429) {
                return { msg: language === 'en' ? 'AI busy. Try later.' : 'AI 助手忙，请稍后再试。' };
            }
            throw new Error('Upstream API error');
        }
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (!reply)
            throw new Error('Empty AI response');
        return { reply };
    }
    catch (error) {
        if (error.name === 'AbortError') {
            return { msg: language === 'en' ? 'AI response timeout. Please try again.' : 'AI 响应超时，请重试。' };
        }
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
    }
};
export const chat = async (req, res, next) => {
    try {
        const validation = aiChatSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { message, context, language, clientMeta } = validation.data;
        const userId = req.user?.id;
        const jailResponse = detectJailbreak(message, userId, language || 'zh', res);
        if (jailResponse)
            return jailResponse;
        await checkRateLimit(userId, req.ip || req.socket.remoteAddress || 'unknown', new Date().toISOString().split('T')[0]);
        if (!ZHIPU_API_KEY)
            throw new AppError('Service unavailable', 503, ErrorCode.INTERNAL_ERROR);
        const activeIds = clientMeta?.activeIntegrationIds;
        const messages = [
            {
                role: 'system',
                content: buildFullAiSystemPrompt(language || 'zh', Array.isArray(activeIds) && activeIds.length > 0 ? activeIds : null),
            },
        ];
        if (req.user)
            messages.push({ role: 'system', content: `Logged-in user (server): ${req.user.username}` });
        if (context)
            messages.push({ role: 'system', content: `Current page: ${context}` });
        if (clientMeta && Object.keys(clientMeta).length > 0) {
            const ids = clientMeta.activeIntegrationIds;
            messages.push({
                role: 'system',
                content: `Client meta (UI hint; permissions are enforced server-side): ${JSON.stringify(clientMeta)}`,
            });
            if (Array.isArray(ids) && ids.length > 0) {
                messages.push({
                    role: 'system',
                    content: `当前页已逐项激活的站点能力点编号（请优先围绕这些点回答）: ${ids.join(', ')}`,
                });
            }
        }
        messages.push({ role: 'user', content: message });
        const result = await callZhipuAPI(messages, language || 'zh');
        if ('msg' in result)
            return sendSuccess(res, { reply: result.msg });
        return sendSuccess(res, { reply: result.reply });
    }
    catch (error) {
        logger.error('[AI Chat] Error:', error);
        const language = getLanguage(req);
        return next(error instanceof Error ? error : new AppError(language === 'en' ? 'AI offline.' : 'AI 助手离线。', 503, ErrorCode.SERVICE_UNAVAILABLE));
    }
};
//# sourceMappingURL=aiController.js.map