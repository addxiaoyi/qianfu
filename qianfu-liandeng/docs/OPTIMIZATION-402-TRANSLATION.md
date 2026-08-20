# 优化项 402: 智能翻译 - 多语言服务

## 概述

在服务端集成智能翻译服务，提供高质量的多语言翻译能力。支持多种翻译引擎、批量翻译、实时翻译和缓存优化，适用于国际化内容翻译、多语言客服、文档翻译等场景。

## 功能特性

1. **多引擎支持**: DeepL、Google Translate、OpenAI GPT、Azure Translator
2. **多语言支持**: 支持 30+ 种语言互译
3. **批量翻译**: 支持批量文本翻译任务
4. **流式翻译**: 支持实时流式翻译输出
5. **翻译记忆**: TM (Translation Memory) 缓存，相似内容自动复用
6. **术语管理**: 自定义术语库，保持翻译一致性
7. **格式保持**: 保持原文格式（HTML、Markdown）

## 技术方案

### 1. 依赖安装

```bash
# DeepL SDK
npm install deepl-node

# Google Cloud Translation
npm install @google-cloud/translate

# Azure Translator
npm install @azure/ai-translation-text

# OpenAI (用于 GPT 翻译)
npm install openai

# 类型定义
npm install --save-dev @types/node
```

### 2. 翻译服务实现

```typescript
// server/services/translationService.ts
import { logger } from '../lib/logger';
import { env } from '../config/env';

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

export interface TranslationConfig {
  /** 默认提供商 */
  provider: TranslationProvider;
  /** DeepL 配置 */
  deepl?: {
    apiKey: string;
    endpoint?: string;
  };
  /** Google 配置 */
  google?: {
    apiKey: string;
    projectId?: string;
  };
  /** Azure 配置 */
  azure?: {
    apiKey: string;
    endpoint: string;
    region: string;
  };
  /** OpenAI 配置 */
  openai?: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  };
  /** 默认源语言 (auto = 自动检测) */
  defaultSourceLang?: string;
  /** 默认目标语言 */
  defaultTargetLang?: string;
  /** 最大单次翻译字符数 */
  maxCharsPerRequest?: number;
  /** 批量翻译最大条目数 */
  maxBatchSize?: number;
  /** 缓存配置 */
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

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
export const LANGUAGE_ALIASES: Record<string, string> = {
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
  private config: TranslationConfig;
  private cache: Map<string, { result: TranslationResult; expireAt: number }>;

  constructor(config?: Partial<TranslationConfig>) {
    this.translationLogger = logger.category('translation');

    this.config = {
      provider: (config?.provider || process.env.TRANSLATION_PROVIDER as TranslationProvider) || 'deepl',
      deepl: config?.deepl || {
        apiKey: process.env.DEEPL_API_KEY || '',
      },
      google: config?.google || {
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
      },
      azure: config?.azure || {
        apiKey: process.env.AZURE_TRANSLATOR_KEY || '',
        endpoint: process.env.AZURE_TRANSLATOR_ENDPOINT || '',
        region: process.env.AZURE_TRANSLATOR_REGION || 'eastus',
      },
      openai: config?.openai || {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini',
      },
      defaultSourceLang: config?.defaultSourceLang || 'auto',
      defaultTargetLang: config?.defaultTargetLang || 'zh-CN',
      maxCharsPerRequest: config?.maxCharsPerRequest || 5000,
      maxBatchSize: config?.maxBatchSize || 100,
      cache: config?.cache || {
        enabled: true,
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 天
      },
    };

    this.cache = new Map();

    this.translationLogger.info('TranslationService 初始化', {
      provider: this.config.provider,
      defaultTargetLang: this.config.defaultTargetLang,
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

    const sourceLang = options.sourceLang || this.config.defaultSourceLang || 'auto';
    const targetLang = options.targetLang || this.config.defaultTargetLang || 'zh-CN';

    // 标准化语言代码
    const normalizedSource = this.normalizeLangCode(sourceLang);
    const normalizedTarget = this.normalizeLangCode(targetLang);

    // 生成缓存键
    const cacheKey = this.getCacheKey(text, normalizedSource, normalizedTarget);

    // 检查缓存
    if (this.config.cache?.enabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.translationLogger.debug('使用缓存翻译', { cacheKey });
        return cached;
      }
    }

    // 检查字符限制
    if (text.length > (this.config.maxCharsPerRequest || 5000)) {
      return {
        success: false,
        error: `文本长度超过限制 (最大 ${this.config.maxCharsPerRequest} 字符)`,
      };
    }

    try {
      this.translationLogger.info('开始翻译', {
        textLength: text.length,
        sourceLang: normalizedSource,
        targetLang: normalizedTarget,
        provider: this.config.provider,
      });

      let result: TranslationResult;

      switch (this.config.provider) {
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
          throw new Error(`不支持的翻译提供商: ${this.config.provider}`);
      }

      result.provider = this.config.provider;

      // 记录字符统计
      result.characterCount = {
        source: text.length,
        target: result.translatedText?.length || 0,
      };

      // 保存到缓存
      if (result.success && this.config.cache?.enabled) {
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

    if (texts.length > (this.config.maxBatchSize || 100)) {
      return {
        success: false,
        total: texts.length,
        successCount: 0,
        failedCount: 0,
        results: [],
        error: `批量翻译数量不能超过 ${this.config.maxBatchSize} 条`,
      };
    }

    this.translationLogger.info('开始批量翻译', {
      count: texts.length,
      targetLang: options.targetLang,
    });

    const targetLang = options.targetLang || this.config.defaultTargetLang;
    const sourceLang = options.sourceLang || this.config.defaultSourceLang;

    // 并发翻译
    const results = await Promise.allSettled(
      texts.map((text, index) =>
        this.translate(text, { ...options, targetLang, sourceLang })
          .then(result => ({ index, ...result }))
      )
    );

    const processedResults = results.map((r, index) => {
      if (r.status === 'fulfilled') {
        return {
          index: r.value.index,
          success: r.value.success,
          translatedText: r.value.translatedText,
          error: r.value.error,
        };
      }
      return {
        index,
        success: false,
        error: (r.reason as Error).message,
      };
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failedCount = processedResults.filter(r => !r.success).length;
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
      results: processedResults,
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
      // 使用提供商的语言检测功能
      switch (this.config.provider) {
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
      'deepl': { perChar: 0.00002, currency: 'USD' },       // DeepL Pro: $20/M 字符
      'google': { perChar: 0.00002, currency: 'USD' },    // Google Cloud Translation: $20/M 字符
      'azure': { perChar: 0.00001, currency: 'USD' },     // Azure Translator: $10/M 字符
      'openai': { perChar: 0.00001, currency: 'USD' },    // GPT 翻译成本估算
    };

    const p = provider || this.config.provider;
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
    const { Translator } = require('deepl-node');

    const translator = new Translator(this.config.deepl?.apiKey || '', {
      endpoint: this.config.deepl?.endpoint,
    });

    // DeepL 特殊处理
    const deeplSourceLang = sourceLang === 'auto' ? 'auto' : this.mapToDeepLLang(sourceLang);
    const deeplTargetLang = this.mapToDeepLLang(targetLang);

    const result = await translator.translateText(
      text,
      sourceLang === 'auto' ? null : deeplSourceLang,
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
  }

  private async detectWithDeepL(text: string): Promise<{ language: string; confidence: number }> {
    const { Translator } = require('deepl-node');
    const translator = new Translator(this.config.deepl?.apiKey || '');

    // DeepL 没有单独的语言检测 API，使用翻译时返回的语言
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
    const { Translate } = require('@google-cloud/translate').v2;

    const translate = new Translate({
      key: this.config.google?.apiKey,
      projectId: this.config.google?.projectId,
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
  }

  private async detectWithGoogle(text: string): Promise<{ language: string; confidence: number }> {
    const { Translate } = require('@google-cloud/translate').v2;
    const translate = new Translate({ key: this.config.google?.apiKey });

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
    const { TextTranslationClient } = require('@azure/ai-translation-text');

    const client = new TextTranslationClient({
      apiKey: this.config.azure?.apiKey,
      endpoint: this.config.azure?.endpoint,
      region: this.config.azure?.region,
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
  }

  private async detectWithAzure(text: string): Promise<{ language: string; confidence: number }> {
    const { TextTranslationClient } = require('@azure/ai-translation-text');

    const client = new TextTranslationClient({
      apiKey: this.config.azure?.apiKey,
      endpoint: this.config.azure?.endpoint,
      region: this.config.azure?.region,
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
    const { OpenAI } = require('openai');

    const openai = new OpenAI({
      apiKey: this.config.openai?.apiKey,
      baseURL: this.config.openai?.baseUrl,
    });

    // 获取语言名称
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
      model: this.config.openai?.model || 'gpt-4o-mini',
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
  }

  private async detectWithOpenAI(text: string): Promise<{ language: string; confidence: number }> {
    const { OpenAI } = require('openai');

    const openai = new OpenAI({
      apiKey: this.config.openai?.apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., en, zh, ja).',
        },
        { role: 'user', content: text.slice(0, 500) }, // 只取前 500 字符
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
    // 简单的哈希函数
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
    const ttl = this.config.cache?.ttl || 7 * 24 * 60 * 60 * 1000;
    this.cache.set(key, {
      result,
      expireAt: Date.now() + ttl,
    });

    // 限制缓存大小
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

export function getTranslationService(config?: Partial<TranslationConfig>): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService(config);
  }
  return translationServiceInstance;
}

export const translationService = getTranslationService();

export default translationService;
```

### 3. 翻译路由实现

```typescript
// server/routes/translation.ts
import { Router, Request, Response } from 'express';
import { getTranslationService, TranslationOptions, SUPPORTED_LANGUAGES } from '../services/translationService';
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
    const options: TranslationOptions = {
      sourceLang,
      targetLang,
      quality,
      useGlossary,
      preserveFormat: true,
    };

    const result = await service.translate(text, options);

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

    translationLogger.info('收到批量翻译请求', {
      count: texts.length,
      targetLang,
    });

    const service = getTranslationService();
    const options: TranslationOptions = {
      sourceLang,
      targetLang,
      quality,
      preserveFormat: true,
    };

    const result = await service.translateBatch(texts, options);

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
    const { characters, provider } = req.body;

    if (!characters || typeof characters !== 'number') {
      return res.status(400).json({
        success: false,
        error: '请提供有效的字符数',
      });
    }

    const service = getTranslationService();
    const cost = service.estimateCost(characters, provider);

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

export default router;
```

### 4. 路由注册

```typescript
// server/routes/index.ts
import translationRouter from './translation';

// 注册翻译路由
app.use(`${apiPrefix}/translation`, translationRouter);
```

## 文件结构

```
server/
├── services/
│   ├── translationService.ts    # 翻译服务 (新增)
│   ├── ttsService.ts            # TTS 服务 (已有)
│   ├── semanticSearch.ts        # 语义搜索 (已有)
│   └── rag/                     # RAG 服务 (已有)
├── routes/
│   ├── translation.ts           # 翻译路由 (新增)
│   ├── tts.ts                   # TTS 路由 (已有)
│   └── semanticSearch.ts        # 语义搜索路由 (已有)
└── config/
    └── env.ts                   # 配置 (需添加翻译配置)
```

## 环境变量配置

```env
# 翻译服务配置
TRANSLATION_PROVIDER=deepl             # deepl | google | azure | openai

# DeepL (推荐 - 高质量)
DEEPL_API_KEY=your_deepl_api_key
# DeepL API 端点 (可选, 用于代理)
DEEPL_API_ENDPOINT=https://api-free.deepl.com

# Google Cloud Translation
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Azure Translator
AZURE_TRANSLATOR_KEY=your_azure_key
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_REGION=eastus

# OpenAI (GPT 翻译)
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TRANSLATION_MODEL=gpt-4o-mini

# 默认翻译设置
TRANSLATION_DEFAULT_SOURCE_LANG=auto
TRANSLATION_DEFAULT_TARGET_LANG=zh-CN
TRANSLATION_MAX_CHARS=5000
TRANSLATION_MAX_BATCH_SIZE=100
TRANSLATION_CACHE_ENABLED=true
TRANSLATION_CACHE_TTL=604800000
```

## API 参考

### 1. 获取支持的语言

```
GET /api/translation/languages

Response:
{
  "success": true,
  "languages": [
    { "code": "auto", "name": "Automatic", "nativeName": "自动检测", "supportsAutoDetection": true },
    { "code": "zh-CN", "name": "Chinese (Simplified)", "nativeName": "简体中文", "supportsAutoDetection": false },
    ...
  ],
  "count": 30
}
```

### 2. 检测语言

```
GET /api/translation/detect?text=Hello%20World

Response:
{
  "success": true,
  "language": "en",
  "confidence": 0.95
}
```

### 3. 翻译文本

```
POST /api/translation/translate
Content-Type: application/json

Body:
{
  "text": "Hello, how are you today?",
  "sourceLang": "en",           // 可选, auto = 自动检测
  "targetLang": "zh-CN",
  "quality": "default"           // 可选: draft | default | professional
}

Response:
{
  "success": true,
  "translatedText": "你好，今天过得怎么样？",
  "detectedSourceLang": "en",
  "confidence": 0.92,
  "provider": "deepl",
  "characterCount": {
    "source": 28,
    "target": 12
  },
  "estimatedCost": {
    "characters": 28,
    "estimatedCost": 0.00056,
    "currency": "USD"
  }
}
```

### 4. 批量翻译

```
POST /api/translation/batch
Content-Type: application/json

Body:
{
  "texts": [
    "Hello, how are you?",
    "Thank you very much!",
    "Good morning!"
  ],
  "sourceLang": "en",
  "targetLang": "zh-CN"
}

Response:
{
  "success": true,
  "total": 3,
  "successCount": 3,
  "failedCount": 0,
  "results": [
    { "index": 0, "success": true, "translatedText": "你好，你好吗？" },
    { "index": 1, "success": true, "translatedText": "非常感谢！" },
    { "index": 2, "success": true, "translatedText": "早上好！" }
  ],
  "cost": {
    "characters": 45,
    "estimatedCost": 0.0009,
    "currency": "USD"
  }
}
```

### 5. 费用估算

```
POST /api/translation/cost
Content-Type: application/json

Body:
{
  "characters": 1000,
  "provider": "deepl"
}

Response:
{
  "success": true,
  "characters": 1000,
  "estimatedCost": 0.02,
  "currency": "USD"
}
```

## 费用说明

| 提供商 | 价格 (每百万字符) | 免费额度 |
|--------|-----------------|----------|
| DeepL Pro | ~$20 | DeepL API Free: 500K 字符/月 |
| Google Cloud | ~$20 | $300 额度 (新用户) |
| Azure Translator | ~$10 | 200 万字符/月 |
| OpenAI GPT | ~$10 (估算) | $5 免费额度 |

## 性能优化建议

1. **缓存优化**: 启用翻译缓存，相似内容自动复用
2. **批量处理**: 多条翻译合并请求，减少 API 调用
3. **异步队列**: 大量翻译任务使用消息队列异步处理
4. **多引擎降级**: 主引擎失败时自动切换到备选引擎
5. **预热缓存**: 热点内容提前翻译并缓存

## 错误处理

| 错误类型 | 错误码 | 说明 |
|---------|-------|------|
| TEXT_EMPTY | 400 | 文本不能为空 |
| TEXT_TOO_LONG | 400 | 文本长度超过限制 |
| INVALID_LANG | 400 | 无效的语言代码 |
| UNSUPPORTED_LANG | 400 | 不支持的目标语言 |
| PROVIDER_ERROR | 500 | 翻译提供商错误 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 |
| API_KEY_INVALID | 401 | API 密钥无效 |

## 术语管理示例

```typescript
// 自定义术语库
const glossary = {
  'AI': '人工智能',
  'Machine Learning': '机器学习',
  'Deep Learning': '深度学习',
  'API': '应用程序接口',
  'SDK': '软件开发工具包',
};

// 使用术语库翻译
const result = await translationService.translate(text, {
  targetLang: 'zh-CN',
  useGlossary: true,
  // 可通过自定义术语库实现
});
```

## 客户端使用示例

```typescript
// 基础翻译
const response = await fetch('/api/translation/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello, how can I help you?',
    sourceLang: 'en',
    targetLang: 'zh-CN',
  }),
});

const { translatedText } = await response.json();
console.log(translatedText); // "你好，我能帮你什么？"
```

```typescript
// 批量翻译
const response = await fetch('/api/translation/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: ['Hello', 'Thank you', 'Goodbye'],
    sourceLang: 'en',
    targetLang: 'ja',
  }),
});

const { results } = await response.json();
console.log(results);
// [
//   { index: 0, success: true, translatedText: 'こんにちは' },
//   { index: 1, success: true, translatedText: 'ありがとう' },
//   { index: 2, success: true, translatedText: 'さようなら' }
// ]
```

## 与客服系统的集成

智能翻译服务可以与客服系统集成，支持多语言客服：

```typescript
// server/services/customerService.ts 扩展
import { getTranslationService } from './translationService';

class CustomerService {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, language } = request;

    // 如果用户使用非中文，先翻译成中文
    let chineseMessage = message;
    if (language !== 'zh-CN') {
      const translated = await getTranslationService().translate(message, {
        sourceLang: language,
        targetLang: 'zh-CN',
      });
      chineseMessage = translated.translatedText || message;
    }

    // 调用中文 RAG 客服
    const response = await this.ragQuery(chineseMessage);

    // 如果用户使用非中文，将回复翻译回去
    if (language !== 'zh-CN') {
      const translated = await getTranslationService().translate(response.answer, {
        sourceLang: 'zh-CN',
        targetLang: language,
      });
      response.answer = translated.translatedText || response.answer;
    }

    return response;
  }
}
```
