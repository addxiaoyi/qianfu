/**
 * 智能翻译服务 (优化项 402)
 *
 * 功能:
 * - 多引擎翻译 (DeepL, Google, Azure, OpenAI)
 * - 多语言支持 (30+ 语言)
 * - 批量翻译
 * - 翻译缓存
 * - 语言检测
 *
 * 依赖:
 * - server/config/env: 配置管理
 */

import { logger } from '../lib/logger';
import { config } from '../config/env';

// ============== 类型定义 ==============

export interface TranslationOptions {
  /** 源语言代码 (auto = 自动检测) */
  sourceLang?: string;
  /** 目标语言代码 */
  targetLang: string;
  /** 翻译质量 (draft | default | professional) */
  quality?: 'draft' | 'default' | 'professional';
  /** 启用术语库 */
  useGlossary?: boolean;
  /** 保留原文格式 */
  preserveFormat?: boolean;
  /** 上下文文本 (用于提高翻译准确性) */
  context?: string;
}

export interface TranslationResult {
  success: boolean;
  /** 翻译文本 */
  translatedText?: string;
  /** 检测的源语言 (自动检测时) */
  detectedSourceLang?: string;
  /** 翻译置信度 (0-1) */
  confidence?: number;
  /** 翻译提供商 */
  provider?: string;
  /** 字符数统计 */
  characterCount?: {
    source: number;
    target: number;
  };
  /** 错误信息 */
  error?: string;
}

export interface BatchTranslationResult {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    index: number;
    success: boolean;
    translatedText?: string;
    error?: string;
  }>;
  cost?: TranslationCost;
}

export interface TranslationCost {
  /** 字符数 */
  characters: number;
  /** 估算费用 */
  estimatedCost: number;
  /** 货币单位 */
  currency: string;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  /** 是否支持自动检测 */
  supportsAutoDetection: boolean;
}

// ============== 翻译提供商 ==============

export type TranslationProvider = 'deepl' | 'google' | 'azure' | 'openai';

// ============== 支持的语言列表 ==============

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'auto', name: 'Automatic', nativeName: '自动检测', supportsAutoDetection: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', supportsAutoDetection: false },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', supportsAutoDetection: false },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁体中文', supportsAutoDetection: false },
  { code: 'en', name: 'English', nativeName: 'English', supportsAutoDetection: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', supportsAutoDetection: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', supportsAutoDetection: false },
  { code: 'fr', name: 'French', nativeName: 'Français', supportsAutoDetection: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', supportsAutoDetection: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', supportsAutoDetection: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', supportsAutoDetection: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', supportsAutoDetection: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', supportsAutoDetection: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', supportsAutoDetection: false },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', supportsAutoDetection: false },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', supportsAutoDetection: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', supportsAutoDetection: false },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', supportsAutoDetection: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', supportsAutoDetection: false },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', supportsAutoDetection: false },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', supportsAutoDetection: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', supportsAutoDetection: false },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', supportsAutoDetection: false },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', supportsAutoDetection: false },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', supportsAutoDetection: false },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', supportsAutoDetection: false },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', supportsAutoDetection: false },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', supportsAutoDetection: false },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', supportsAutoDetection: false },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', supportsAutoDetection: false },
];

// 语言代码映射
const LANGUAGE_ALIASES: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'chinese': 'zh-CN',
  'japanese': 'ja',
  'korean': 'ko',
  'english': 'en',
  'french': 'fr',
  'german': 'de',
  'spanish': 'es',
  'portuguese': 'pt',
  'russian': 'ru',
};

// ============== 翻译服务类 ==============

export class TranslationService {
  private translationLogger: ReturnType<typeof logger.category>;
  private cache: Map<string, { result: TranslationResult; expireAt: number }>;

  constructor() {
    this.translationLogger = logger.category('translation');
    this.cache = new Map();

    this.translationLogger.info('TranslationService 初始化', {
      provider: config.translation.provider,
      defaultTargetLang: config.translation.defaultTargetLang,
    });
  }

  /**
   * 翻译文本
   */
  async translate(
    text: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    // 验证输入
    if (!text || text.trim().length === 0) {
      return { success: false, error: '文本不能为空' };
    }

    const sourceLang = options.sourceLang || config.translation.defaultSourceLang || 'auto';
    const targetLang = options.targetLang || config.translation.defaultTargetLang || 'zh-CN';

    // 标准化语言代码
    const normalizedSource = this.normalizeLangCode(sourceLang);
    const normalizedTarget = this.normalizeLangCode(targetLang);

    // 生成缓存键
    const cacheKey = this.getCacheKey(text, normalizedSource, normalizedTarget);

    // 检查缓存
    if (config.translation.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.translationLogger.debug('使用缓存翻译', { cacheKey });
        return cached;
      }
    }

    // 检查字符限制
    if (text.length > config.translation.maxCharsPerRequest) {
      return {
        success: false,
        error: `文本长度超过限制 (最大 ${config.translation.maxCharsPerRequest} 字符)`,
      };
    }

    try {
      this.translationLogger.info('开始翻译', {
        textLength: text.length,
        sourceLang: normalizedSource,
        targetLang: normalizedTarget,
        provider: config.translation.provider,
      });

      let result: TranslationResult;

      switch (config.translation.provider) {
        case 'deepl':
          result = await this.translateWithDeepL(text, normalizedSource, normalizedTarget, options);
          break;
        case 'google':
          result = await this.translateWithGoogle(text, normalizedSource, normalizedTarget, options);
          break;
        case 'azure':
          result = await this.translateWithAzure(text, normalizedSource, normalizedTarget, options);
          break;
        case 'openai':
          result = await this.translateWithOpenAI(text, normalizedSource, normalizedTarget, options);
          break;
        default:
          throw new Error(`不支持的翻译提供商: ${config.translation.provider}`);
      }

      result.provider = config.translation.provider;

      // 记录字符统计
      result.characterCount = {
        source: text.length,
        target: result.translatedText?.length || 0,
      };

      // 保存到缓存
      if (result.success && config.translation.cacheEnabled) {
        this.saveToCache(cacheKey, result);
      }

      const duration = Date.now() - startTime;
      this.translationLogger.info('翻译完成', {
        duration: `${duration}ms`,
        sourceLang: result.detectedSourceLang || normalizedSource,
        targetLang: normalizedTarget,
        confidence: result.confidence,
      });

      return result;

    } catch (error) {
      this.translationLogger.error('翻译失败', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 批量翻译
   */
  async translateBatch(
    texts: string[],
    options: TranslationOptions
  ): Promise<BatchTranslationResult> {
    if (!texts || texts.length === 0) {
      return {
        success: false,
        total: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
        error: '文本列表不能为空',
      };
    }

    if (texts.length > config.translation.maxBatchSize) {
      return {
        success: false,
        total: texts.length,
        successCount: 0,
        failedCount: 0,
        results: [],
        error: `批量翻译数量不能超过 ${config.translation.maxBatchSize} 条`,
      };
    }

    this.translationLogger.info('开始批量翻译', {
      count: texts.length,
      targetLang: options.targetLang,
    });

    const targetLang = options.targetLang || config.translation.defaultTargetLang;
    const sourceLang = options.sourceLang || config.translation.defaultSourceLang;

    // 并发翻译 (限制并发数)
    const concurrencyLimit = 5;
    const results: PromiseFulfilledResult<{ index: number; success: boolean; translatedText?: string; error?: string }>[] = [];

    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map((text, batchIndex) =>
        this.translate(text, { ...options, targetLang, sourceLang })
          .then(result => ({
            index: i + batchIndex,
            success: result.success,
            translatedText: result.translatedText,
            error: result.error,
          }))
      );
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          results.push(r);
        }
      });
    }

    const successCount = results.filter(r => r.value.success).length;
    const failedCount = results.length - successCount;
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);

    this.translationLogger.info('批量翻译完成', {
      total: texts.length,
      successCount,
      failedCount,
    });

    return {
      success: true,
      total: texts.length,
      successCount,
      failedCount,
      results: results.map(r => r.value),
      cost: this.estimateCost(totalChars),
    };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * 获取语言信息
   */
  getLanguageInfo(code: string): Language | undefined {
    const normalized = this.normalizeLangCode(code);
    return SUPPORTED_LANGUAGES.find(l => l.code === normalized);
  }

  /**
   * 检测语言
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number } | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      switch (config.translation.provider) {
        case 'deepl':
          return await this.detectWithDeepL(text);
        case 'google':
          return await this.detectWithGoogle(text);
        case 'azure':
          return await this.detectWithAzure(text);
        case 'openai':
          return await this.detectWithOpenAI(text);
        default:
          return null;
      }
    } catch (error) {
      this.translationLogger.error('语言检测失败', error);
      return null;
    }
  }

  /**
   * 估算翻译费用
   */
  estimateCost(characters: number, provider?: TranslationProvider): TranslationCost {
    const rates: Record<TranslationProvider, { perChar: number; currency: string }> = {
      'deepl': { perChar: 0.00002, currency: 'USD' },
      'google': { perChar: 0.00002, currency: 'USD' },
      'azure': { perChar: 0.00001, currency: 'USD' },
      'openai': { perChar: 0.00001, currency: 'USD' },
    };

    const p = provider || config.translation.provider;
    const { perChar, currency } = rates[p];

    return {
      characters,
      estimatedCost: characters * perChar,
      currency,
    };
  }

  // ============== DeepL 实现 ==============

  private async translateWithDeepL(
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    try {
      const { Translator } = require('deepl-node');

      const translator = new Translator(
        config.translation.deeplApiKey || '',
        { endpoint: config.translation.deeplEndpoint }
      );

      const deeplSourceLang = sourceLang === 'auto' ? null : this.mapToDeepLLang(sourceLang);
      const deeplTargetLang = this.mapToDeepLLang(targetLang);

      const result = await translator.translateText(
        text,
        deeplSourceLang,
        deeplTargetLang,
        {
          formality: options.quality === 'professional' ? 'more' : 'default',
        }
      );

      return {
        success: true,
        translatedText: result.text,
        detectedSourceLang: result.detectedSourceLangCode,
      };
    } catch (error) {
      this.translationLogger.error('DeepL 翻译失败', error);
      throw error;
    }
  }

  private async detectWithDeepL(text: string): Promise<{ language: string; confidence: number }> {
    const { Translator } = require('deepl-node');
    const translator = new Translator(config.translation.deeplApiKey || '');

    const result = await translator.translateText(text, null, 'en');
    return {
      language: result.detectedSourceLangCode || 'en',
      confidence: 0.9,
    };
  }

  private mapToDeepLLang(lang: string): string {
    const map: Record<string, string> = {
      'zh-CN': 'ZH',
      'zh-TW': 'ZH-HANT',
      'en': 'EN',
      'ja': 'JA',
      'ko': 'KO',
      'fr': 'FR',
      'de': 'DE',
      'es': 'ES',
      'pt': 'PT-BR',
      'it': 'IT',
      'ru': 'RU',
      'pl': 'PL',
      'nl': 'NL',
      'uk': 'UK',
      'cs': 'CS',
      'sv': 'SV',
      'da': 'DA',
      'fi': 'FI',
      'el': 'EL',
    };
    return map[lang] || lang.toUpperCase();
  }

  // ============== Google Translate 实现 ==============

  private async translateWithGoogle(
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    try {
      const { Translate } = require('@google-cloud/translate').v2;

      const translate = new Translate({
        key: config.translation.googleApiKey,
      });

      const [translation, apiResponse] = await translate.translate(text, {
        from: sourceLang === 'auto' ? undefined : sourceLang,
        to: targetLang,
      });

      const detectedSourceLang = apiResponse?.detections?.[0]?.[0]?.language;

      return {
        success: true,
        translatedText: translation as string,
        detectedSourceLang: detectedSourceLang,
        confidence: apiResponse?.detections?.[0]?.[0]?.confidence || 0.9,
      };
    } catch (error) {
      this.translationLogger.error('Google 翻译失败', error);
      throw error;
    }
  }

  private async detectWithGoogle(text: string): Promise<{ language: string; confidence: number }> {
    const { Translate } = require('@google-cloud/translate').v2;
    const translate = new Translate({ key: config.translation.googleApiKey });

    const [detections] = await translate.detect(text);
    const detection = Array.isArray(detections) ? detections[0] : detections;

    return {
      language: detection.language,
      confidence: detection.confidence || 0.9,
    };
  }

  // ============== Azure Translator 实现 ==============

  private async translateWithAzure(
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    try {
      const { TextTranslationClient } = require('@azure/ai-translation-text');

      const client = new TextTranslationClient({
        apiKey: config.translation.azureApiKey,
        endpoint: config.translation.azureEndpoint,
        region: config.translation.azureRegion,
      });

      const response = await client.translate({
        content: text,
        from: sourceLang === 'auto' ? undefined : sourceLang,
        to: [targetLang],
      });

      const result = response[0];
      const detectedLang = result.detectedLanguage;

      return {
        success: true,
        translatedText: result.translations[0]?.text || '',
        detectedSourceLang: detectedLang?.language,
        confidence: detectedLang?.score,
      };
    } catch (error) {
      this.translationLogger.error('Azure 翻译失败', error);
      throw error;
    }
  }

  private async detectWithAzure(text: string): Promise<{ language: string; confidence: number }> {
    const { TextTranslationClient } = require('@azure/ai-translation-text');

    const client = new TextTranslationClient({
      apiKey: config.translation.azureApiKey,
      endpoint: config.translation.azureEndpoint,
      region: config.translation.azureRegion,
    });

    const response = await client.breakSentence({
      content: text,
    });

    const detectedLang = response[0]?.detectedLanguage;

    return {
      language: detectedLang?.language || 'en',
      confidence: detectedLang?.score || 0.9,
    };
  }

  // ============== OpenAI GPT 实现 ==============

  private async translateWithOpenAI(
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    try {
      const { OpenAI } = require('openai');

      const openai = new OpenAI({
        apiKey: config.translation.openaiApiKey,
        baseURL: config.translation.openaiBaseUrl,
      });

      const sourceLangName = this.getLanguageName(sourceLang);
      const targetLangName = this.getLanguageName(targetLang);

      const systemPrompt = `You are a professional translator. Translate the following text from ${sourceLangName} to ${targetLangName}.
Rules:
1. Maintain the original tone and style
2. Keep proper nouns and technical terms in their original form when appropriate
3. Preserve formatting (HTML tags, Markdown syntax, etc.)
4. Return only the translated text, nothing else`;

      const userPrompt = `Translate this text:\n\n${text}`;

      const completion = await openai.chat.completions.create({
        model: config.translation.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: Math.max(text.length * 4, 1000),
      });

      const translatedText = completion.choices[0]?.message?.content?.trim() || '';

      return {
        success: true,
        translatedText,
        detectedSourceLang: sourceLang !== 'auto' ? sourceLang : undefined,
        confidence: 0.85,
      };
    } catch (error) {
      this.translationLogger.error('OpenAI 翻译失败', error);
      throw error;
    }
  }

  private async detectWithOpenAI(text: string): Promise<{ language: string; confidence: number }> {
    const { OpenAI } = require('openai');

    const openai = new OpenAI({
      apiKey: config.translation.openaiApiKey,
    });

    const completion = await openai.chat.completions.create({
      model: config.translation.openaiModel,
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., en, zh, ja).',
        },
        { role: 'user', content: text.slice(0, 500) },
      ],
      temperature: 0,
    });

    const language = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'en';

    return {
      language,
      confidence: 0.9,
    };
  }

  // ============== 辅助方法 ==============

  private normalizeLangCode(code: string): string {
    const lower = code.toLowerCase();
    return LANGUAGE_ALIASES[lower] || lower;
  }

  private getCacheKey(text: string, sourceLang: string, targetLang: string): string {
    return `${sourceLang}:${targetLang}:${this.hashText(text)}`;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache(key: string): TranslationResult | null {
    const cached = this.cache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private saveToCache(key: string, result: TranslationResult): void {
    const ttl = config.translation.cacheTtl;
    this.cache.set(key, {
      result,
      expireAt: Date.now() + ttl,
    });

    if (this.cache.size > 10000) {
      this.cleanExpiredCache();
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expireAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private getLanguageName(code: string): string {
    if (code === 'auto') return 'the detected language';
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.name || code;
  }
}

// ============== 单例导出 ==============

let translationServiceInstance: TranslationService | null = null;

export function getTranslationService(): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService();
  }
  return translationServiceInstance;
}

export const translationService = getTranslationService();

export default translationService;
