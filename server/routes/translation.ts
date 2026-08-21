/**
 * 翻译服务路由 (优化项 402: 智能翻译)
 *
 * 提供 REST API 接口:
 * - GET /languages: 获取支持的语言列表
 * - GET /detect: 检测语言
 * - POST /translate: 翻译文本
 * - POST /batch: 批量翻译
 * - POST /cost: 估算费用
 */

import { Router, Request, Response } from 'express';
import { getTranslationService, SUPPORTED_LANGUAGES } from '../services/translationService';
import { logger } from '../lib/logger';

const router = Router();
const translationLogger = logger.category('translation-route');

// ============== 类型定义 ==============

interface TranslateRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
  quality?: 'draft' | 'default' | 'professional';
  useGlossary?: boolean;
}

interface BatchTranslateRequest {
  texts: string[];
  sourceLang?: string;
  targetLang: string;
  quality?: 'draft' | 'default' | 'professional';
}

interface DetectLanguageRequest {
  text: string;
}

// ============== 路由处理 ==============

/**
 * GET /api/translation/languages
 * 获取支持的语言列表
 */
router.get('/languages', (req: Request, res: Response) => {
  try {
    const service = getTranslationService();
    const languages = service.getSupportedLanguages();

    res.json({
      success: true,
      languages,
      count: languages.length,
    });
  } catch (error) {
    translationLogger.error('获取语言列表失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/translation/detect
 * 检测语言
 */
router.get('/detect', async (req: Request, res: Response) => {
  try {
    const { text } = req.query as { text?: string };

    if (!text) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: text',
      });
    }

    const service = getTranslationService();
    const result = await service.detectLanguage(text);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: '语言检测失败',
      });
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    translationLogger.error('语言检测失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/translation/translate
 * 翻译文本
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLang, targetLang, quality, useGlossary } = req.body as TranslateRequest;

    // 验证必填参数
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: text',
      });
    }

    if (!targetLang) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: targetLang',
      });
    }

    // 验证文本类型
    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text 必须是字符串',
      });
    }

    translationLogger.info('收到翻译请求', {
      textLength: text.length,
      sourceLang,
      targetLang,
    });

    const service = getTranslationService();
    const result = await service.translate(text, {
      sourceLang,
      targetLang,
      quality,
      useGlossary,
      preserveFormat: true,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // 估算费用
    const cost = service.estimateCost(text.length);

    res.json({
      success: true,
      translatedText: result.translatedText,
      detectedSourceLang: result.detectedSourceLang,
      confidence: result.confidence,
      provider: result.provider,
      characterCount: result.characterCount,
      estimatedCost: cost,
    });

  } catch (error) {
    translationLogger.error('翻译失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/translation/batch
 * 批量翻译
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { texts, sourceLang, targetLang, quality } = req.body as BatchTranslateRequest;

    // 验证参数
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少或无效的参数: texts (需要字符串数组)',
      });
    }

    if (!targetLang) {
      return res.status(400).json({
        success: false,
        error: '缺少参数: targetLang',
      });
    }

    // 验证所有文本都是字符串
    const invalidTexts = texts.filter(t => typeof t !== 'string');
    if (invalidTexts.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'texts 数组中所有元素都必须是字符串',
      });
    }

    translationLogger.info('收到批量翻译请求', {
      count: texts.length,
      targetLang,
    });

    const service = getTranslationService();
    const result = await service.translateBatch(texts, {
      sourceLang,
      targetLang,
      quality,
      preserveFormat: true,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json(result);

  } catch (error) {
    translationLogger.error('批量翻译失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/translation/cost
 * 估算翻译费用
 */
router.post('/cost', (req: Request, res: Response) => {
  try {
    const { characters, provider } = req.body as { characters?: number; provider?: string };

    if (!characters || typeof characters !== 'number') {
      return res.status(400).json({
        success: false,
        error: '请提供有效的字符数',
      });
    }

    if (characters < 0) {
      return res.status(400).json({
        success: false,
        error: '字符数不能为负数',
      });
    }

    const service = getTranslationService();
    const cost = service.estimateCost(
      characters,
      provider as 'deepl' | 'google' | 'azure' | 'openai'
    );

    res.json({
      success: true,
      ...cost,
    });
  } catch (error) {
    translationLogger.error('费用估算失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/translation/health
 * 健康检查
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    provider: 'translation',
    supportedLanguages: SUPPORTED_LANGUAGES.length,
  });
});

export default router;
