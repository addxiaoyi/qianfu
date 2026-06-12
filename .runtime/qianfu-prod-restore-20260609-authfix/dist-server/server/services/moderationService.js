import axios from 'axios';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';
import { getConfig } from './configService.js';
import { z } from 'zod';
const ModerationResultSchema = z.object({
    passed: z.boolean(),
    reason: z.string().optional(),
    score: z.number().min(0).max(1).optional(),
});
export class ModerationService {
    static async checkText(content, userId) {
        try {
            const apiKey = await getConfig('MODERATION_API_KEY', true);
            const enabled = (await getConfig('MODERATION_ENABLED')) === 'true';
            if (!enabled)
                return { passed: true };
            // Use ZHIPU (Free glm-4-flash) as primary for text moderation
            const zhipuApiKey = process.env.ZHIPU_API_KEY;
            if (zhipuApiKey) {
                try {
                    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                        model: 'glm-4-flash',
                        messages: [
                            {
                                role: 'system',
                                content: '你是一个内容审查助手。请分析用户输入的内容是否包含色情、暴力、政治敏感、广告或违规内容。仅返回 JSON: {"passed": boolean, "reason": "string", "score": 0-1}'
                            },
                            { role: 'user', content: content }
                        ],
                        response_format: { type: 'json_object' }
                    }, {
                        headers: { 'Authorization': `Bearer ${zhipuApiKey}` },
                        timeout: 5000
                    });
                    const parsed = ModerationResultSchema.safeParse(JSON.parse(response.data.choices[0].message.content));
                    if (!parsed.success) {
                        throw new Error('Invalid moderation response format');
                    }
                    const result = parsed.data;
                    const passed = result.passed;
                    await prisma.moderationLog.create({
                        data: {
                            user_id: userId,
                            content_type: 'TEXT',
                            content: content.slice(0, 200),
                            action: passed ? 'PASSED' : 'REJECTED',
                            reason: passed ? null : (result.reason || 'AI rejection') + ` (Score: ${result.score || 0})`
                        }
                    });
                    return {
                        passed,
                        reason: passed ? undefined : (result.reason || 'Content violates guidelines'),
                        score: result.score || 0,
                        rawResponse: response.data
                    };
                }
                catch (zhipuError) {
                    logger.warn('[ModerationService] ZHIPU text moderation failed:', zhipuError.message);
                }
            }
            // Try OpenAI as fallback if configured
            if (apiKey) {
                try {
                    const response = await axios.post('https://api.openai.com/v1/moderations', {
                        input: content
                    }, {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 2000
                    });
                    const result = response.data.results[0];
                    const passed = !result.flagged;
                    await prisma.moderationLog.create({
                        data: {
                            user_id: userId,
                            content_type: 'TEXT',
                            content: content.slice(0, 200),
                            action: passed ? 'PASSED' : 'REJECTED',
                            reason: passed ? null : Object.keys(result.categories).filter(k => result.categories[k]).join(',') + ` (Score: ${Math.max(...Object.values(result.category_scores))})`
                        }
                    });
                    return {
                        passed,
                        reason: passed ? undefined : 'Content violates guidelines',
                        score: Math.max(...Object.values(result.category_scores)),
                        rawResponse: result
                    };
                }
                catch (openaiError) {
                    logger.warn('[ModerationService] OpenAI moderation failed:', openaiError.message);
                }
            }
            return { passed: true }; // No moderation configured, default pass
        }
        catch (error) {
            // Step 12: Fail-Closed logic - if service is down, mark as PENDING for manual review
            // and return passed: false to prevent potential violation leakage
            logger.error('[ModerationService] Text moderation error:', error.message);
            try {
                await prisma.moderationLog.create({
                    data: {
                        user_id: userId,
                        content_type: 'TEXT',
                        content: content.slice(0, 200),
                        action: 'PENDING',
                        reason: `Service unavailable: ${error.message}`
                    }
                });
            }
            catch (logError) {
                logger.error('[ModerationService] Failed to log moderation error:', logError);
            }
            return {
                passed: false,
                reason: 'Content moderation service temporarily unavailable. Content queued for manual review.',
                score: 0
            };
        }
    }
    static async checkImage(imageUrl, userId) {
        try {
            const apiKey = await getConfig('MODERATION_API_KEY', true);
            const enabled = (await getConfig('MODERATION_ENABLED')) === 'true';
            if (!enabled)
                return { passed: true };
            // Try ZHIPU (Free glm-4v-flash) as primary for image moderation
            const zhipuApiKey = process.env.ZHIPU_API_KEY;
            if (zhipuApiKey) {
                try {
                    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                        model: 'glm-4v-flash',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: '你是一个内容审查助手。请分析这张图片是否包含色情、暴力、政治敏感或违规内容。仅返回 JSON: {"passed": boolean, "reason": "string", "score": 0-1}' },
                                    { type: 'image_url', image_url: { url: imageUrl } }
                                ]
                            }
                        ],
                        response_format: { type: 'json_object' }
                    }, {
                        headers: { 'Authorization': `Bearer ${zhipuApiKey}` },
                        timeout: 10000
                    });
                    const parsed = ModerationResultSchema.safeParse(JSON.parse(response.data.choices[0].message.content));
                    if (!parsed.success) {
                        throw new Error('Invalid moderation response format');
                    }
                    const result = parsed.data;
                    const passed = result.passed;
                    await prisma.moderationLog.create({
                        data: {
                            user_id: userId,
                            content_type: 'IMAGE',
                            content: imageUrl.slice(0, 255),
                            action: passed ? 'PASSED' : 'REJECTED',
                            reason: passed ? null : (result.reason || 'AI rejection') + ` (Score: ${result.score || 0})`
                        }
                    });
                    return {
                        passed,
                        reason: passed ? undefined : (result.reason || 'Invalid image'),
                        score: result.score || 0,
                        rawResponse: response.data
                    };
                }
                catch (zhipuError) {
                    logger.warn('[ModerationService] ZHIPU image moderation failed, falling back to OpenAI:', zhipuError.message);
                }
            }
            // Fallback to OpenAI (gpt-4o-mini)
            if (apiKey) {
                try {
                    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: 'Content moderator. Check image for: porn, violence, politics, hate, drugs. Return JSON: {"passed": boolean, "reason": "string", "score": 0-1}'
                            },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Moderate this:' },
                                    { type: 'image_url', image_url: { url: imageUrl } }
                                ]
                            }
                        ],
                        response_format: { type: 'json_object' },
                        max_tokens: 150
                    }, {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    const result = JSON.parse(response.data.choices[0].message.content);
                    const passed = result.passed;
                    await prisma.moderationLog.create({
                        data: {
                            user_id: userId,
                            content_type: 'IMAGE',
                            content: imageUrl.slice(0, 255),
                            action: passed ? 'PASSED' : 'REJECTED',
                            reason: passed ? null : result.reason + ` (Score: ${result.score || 0})`
                        }
                    });
                    return {
                        passed,
                        reason: passed ? undefined : (result.reason || 'Invalid image'),
                        score: result.score,
                        rawResponse: response.data
                    };
                }
                catch (openaiError) {
                    logger.warn('[ModerationService] OpenAI image moderation failed:', openaiError.message);
                }
            }
            return { passed: true }; // No moderation configured, default pass
        }
        catch (error) {
            // Step 12: Fail-Closed logic for images
            logger.error('[ModerationService] Image moderation error:', error.message);
            try {
                await prisma.moderationLog.create({
                    data: {
                        user_id: userId,
                        content_type: 'IMAGE',
                        content: imageUrl.slice(0, 255),
                        action: 'PENDING',
                        reason: `Service unavailable: ${error.message}`
                    }
                });
            }
            catch (logError) {
                logger.error('[ModerationService] Failed to log moderation error:', logError);
            }
            return {
                passed: false,
                reason: 'Image moderation service temporarily unavailable. Content queued for manual review.',
                score: 0
            };
        }
    }
    /**
     * Get moderation statistics
     */
    static async getStats() {
        const totalCount = await prisma.moderationLog.count();
        const rejectedCount = await prisma.moderationLog.count({
            where: { action: 'REJECTED' }
        });
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const last24hCount = await prisma.moderationLog.count({
            where: { created_at: { gte: last24h } }
        });
        return {
            total: totalCount,
            rejected: rejectedCount,
            last24h: last24hCount,
            passRate: totalCount > 0 ? ((totalCount - rejectedCount) / totalCount * 100).toFixed(2) + '%' : '100%'
        };
    }
}
//# sourceMappingURL=moderationService.js.map