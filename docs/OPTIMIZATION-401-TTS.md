# 优化项 401: 语音合成 - TTS 服务

## 概述

在服务端集成语音合成（Text-to-Speech, TTS）服务，提供高质量的文字转语音能力。支持多种语音风格、音色选择和实时流式输出，适用于无障碍访问、语音播报、辅助功能等场景。

## 功能特性

1. **多语言支持**: 支持中文、英文、日文、韩文等多种语言
2. **多种音色**: 提供多种音色选择（男声/女声/儿童声）
3. **语音风格**: 支持不同语速、音调、音量调节
4. **流式输出**: 支持实时流式语音合成，减少首字节延迟
5. **格式多样**: 支持 MP3、WAV、OGG 等音频格式
6. **SSML 标记**: 支持 SSML 标记语言，实现更精细的语音控制
7. **批量处理**: 支持批量文本转语音任务

## 技术方案

### 1. 依赖安装

```bash
# 安装 OpenAI TTS 客户端 (使用 Azure OpenAI 或 OpenAI)
npm install openai @azure/openai

# 或使用 Edge-TTS (微软免费TTS)
npm install edge-tts

# 或使用 Coqui TTS (开源方案)
npm install @coqui/tts

# 类型定义
npm install --save-dev @types/node
```

### 2. TTS 服务实现

```typescript
// server/services/ttsService.ts
import { logger } from '../lib/logger';
import { config as appConfig } from '../config/env';
import { Readable } from 'stream';

// ============== 类型定义 ==============

export interface TTSOptions {
  /** 输出音频格式 */
  format?: 'mp3' | 'wav' | 'ogg' | 'opus';
  /** 语音模型 */
  model?: string;
  /** 语音标识符 */
  voice?: string;
  /** 语速 (0.25 - 4.0, 默认 1.0) */
  speed?: number;
  /** 音调 (0.5 - 2.0, 默认 1.0) */
  pitch?: number;
  /** 音量 (0.0 - 1.0, 默认 1.0) */
  volume?: number;
  /** 是否启用 SSML */
  enableSSML?: boolean;
  /** 输出目录 */
  outputDir?: string;
}

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  audioFormat?: string;
  duration?: number;
  charactersUsed?: number;
  cost?: number;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  language: string;
  languageCode: string;
  description?: string;
}

// ============== TTS 提供商 ==============

export type TTSProvider = 'azure' | 'openai' | 'edge' | 'coqui';

export interface TTSConfig {
  provider: TTSProvider;
  apiKey?: string;
  endpoint?: string;
  defaultVoice?: string;
  defaultFormat?: 'mp3' | 'wav' | 'ogg' | 'opus';
  maxTextLength?: number;
  maxConcurrentRequests?: number;
}

// ============== 预设音色列表 ==============

export const VOICE_PRESETS: Record<string, Voice[]> = {
  // 中文音色
  zh-CN: [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', language: '中文', languageCode: 'zh-CN', description: '标准女声' },
    { id: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', language: '中文', languageCode: 'zh-CN', description: '青年男声' },
    { id: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', language: '中文', languageCode: 'zh-CN', description: '新闻男声' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', language: '中文', languageCode: 'zh-CN', description: '活泼女声' },
  ],
  // 英文音色
  en-US: [
    { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'female', language: 'English', languageCode: 'en-US', description: 'Standard female voice' },
    { id: 'en-US-GuyNeural', name: 'Guy', gender: 'male', language: 'English', languageCode: 'en-US', description: 'Standard male voice' },
    { id: 'en-US-AriaNeural', name: 'Aria', gender: 'female', language: 'English', languageCode: 'en-US', description: 'News anchor style' },
    { id: 'en-US-SaraNeural', name: 'Sara', gender: 'female', language: 'English', languageCode: 'en-US', description: 'Friendly female voice' },
  ],
  // 日文音色
  ja-JP: [
    { id: 'ja-JP-NanamiNeural', name: '七海', gender: 'female', language: '日本語', languageCode: 'ja-JP', description: '標準女性' },
    { id: 'ja-JP-KeitaNeural', name: '慧太', gender: 'male', language: '日本語', languageCode: 'ja-JP', description: '標準男性' },
  ],
  // 韩文音色
  ko-KR: [
    { id: 'ko-KR-SunHiNeural', name: '선히', gender: 'female', language: '한국어', languageCode: 'ko-KR', description: '표준 여성' },
    { id: 'ko-KR-InJoonNeural', name: '인준', gender: 'male', language: '한국어', languageCode: 'ko-KR', description: '표준 남성' },
  ],
};

// ============== TTS 服务类 ==============

export class TTSService {
  private ttsLogger: ReturnType<typeof logger.category>;
  private config: TTSConfig;
  private tempDir: string;

  constructor(config?: Partial<TTSConfig>) {
    this.ttsLogger = logger.category('tts');
    
    this.config = {
      provider: config?.provider || (process.env.TTS_PROVIDER as TTSProvider) || 'azure',
      apiKey: config?.apiKey || process.env.TTS_API_KEY,
      endpoint: config?.endpoint || process.env.TTS_ENDPOINT,
      defaultVoice: config?.defaultVoice || 'zh-CN-XiaoxiaoNeural',
      defaultFormat: config?.defaultFormat || 'mp3',
      maxTextLength: config?.maxTextLength || 10000,
      maxConcurrentRequests: config?.maxConcurrentRequests || 10,
    };

    this.tempDir = process.env.TTS_TEMP_DIR || './temp/tts';
    
    this.ttsLogger.info('TTS服务初始化', { 
      provider: this.config.provider,
      defaultVoice: this.config.defaultVoice 
    });
  }

  /**
   * 获取可用音色列表
   */
  getVoices(language?: string): Voice[] {
    if (language && VOICE_PRESETS[language]) {
      return VOICE_PRESETS[language];
    }
    
    // 返回所有音色
    return Object.values(VOICE_PRESETS).flat();
  }

  /**
   * 文本转语音
   */
  async synthesize(
    text: string, 
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const startTime = Date.now();
    
    // 验证输入
    if (!text || text.trim().length === 0) {
      return { success: false, error: '文本不能为空' };
    }
    
    if (text.length > (options.maxTextLength || this.config.maxTextLength!)) {
      return { 
        success: false, 
        error: `文本长度超过限制 (最大 ${options.maxTextLength || this.config.maxTextLength} 字符)` 
      };
    }

    const format = options.format || this.config.defaultFormat!;
    const voice = options.voice || this.config.defaultVoice!;

    try {
      this.ttsLogger.info('开始语音合成', {
        textLength: text.length,
        voice,
        format,
        provider: this.config.provider,
      });

      let audioBuffer: Buffer;

      switch (this.config.provider) {
        case 'azure':
          audioBuffer = await this.synthesizeWithAzure(text, { ...options, format, voice });
          break;
        case 'openai':
          audioBuffer = await this.synthesizeWithOpenAI(text, { ...options, format, voice });
          break;
        case 'edge':
          audioBuffer = await this.synthesizeWithEdge(text, { ...options, format, voice });
          break;
        case 'coqui':
          audioBuffer = await this.synthesizeWithCoqui(text, { ...options, format, voice });
          break;
        default:
          throw new Error(`不支持的 TTS 提供商: ${this.config.provider}`);
      }

      const duration = Date.now() - startTime;
      const charactersUsed = text.length;
      
      this.ttsLogger.info('语音合成完成', {
        textLength: text.length,
        audioSize: audioBuffer.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        audioBuffer,
        audioFormat: format,
        charactersUsed,
        duration,
      };

    } catch (error) {
      this.ttsLogger.error('语音合成失败', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 流式语音合成
   */
  async *synthesizeStream(
    text: string,
    options: TTSOptions = {}
  ): AsyncGenerator<Buffer, void, unknown> {
    if (!text || text.trim().length === 0) {
      throw new Error('文本不能为空');
    }

    const format = options.format || this.config.defaultFormat!;
    const voice = options.voice || this.config.defaultVoice!;

    this.ttsLogger.info('开始流式语音合成', {
      textLength: text.length,
      voice,
      format,
    });

    switch (this.config.provider) {
      case 'azure':
        yield* this.synthesizeStreamAzure(text, { ...options, format, voice });
        break;
      case 'openai':
        yield* this.synthesizeStreamOpenAI(text, { ...options, format, voice });
        break;
      case 'edge':
        yield* this.synthesizeStreamEdge(text, { ...options, format, voice });
        break;
      default:
        // 非流式提供商，降级为普通合成
        const result = await this.synthesize(text, options);
        if (result.success && result.audioBuffer) {
          yield result.audioBuffer;
        } else {
          throw new Error(result.error || '合成失败');
        }
    }
  }

  // ============== Azure TTS 实现 ==============

  private async synthesizeWithAzure(
    text: string, 
    options: TTSOptions & { voice: string; format: string }
  ): Promise<Buffer> {
    const { AzureKeyCredential } = require('@azure/cognitiveservices-speech-sdk');
    const speechConfig = require('@azure/cognitiveservices-speech-sdk').SpeechConfig;
    
    const speechKey = this.config.apiKey || process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    const speechConfigInstance = speechConfig.fromSubscription(speechKey, region);
    speechConfigInstance.speechSynthesisOutputFormat = this.getAzureOutputFormat(options.format);

    const synthesizer = new (require('@azure/cognitiveservices-speech-sdk').SpeechSynthesizer)(
      speechConfigInstance, 
      null
    );

    return new Promise((resolve, reject) => {
      const ssml = this.buildSSML(text, options);
      
      synthesizer.speakSsmlAsync(
        ssml,
        (result: any) => {
          synthesizer.close();
          
          if (result.errorDetails) {
            reject(new Error(result.errorDetails));
          } else {
            resolve(Buffer.from(result.audioData));
          }
        },
        (error: any) => {
          synthesizer.close();
          reject(error);
        }
      );
    });
  }

  private async *synthesizeStreamAzure(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): AsyncGenerator<Buffer, void, unknown> {
    const { SpeechSynthesizer, SpeechConfig, AudioConfig } = require('@azure/cognitiveservices-speech-sdk');
    
    const speechKey = this.config.apiKey || process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    const speechConfig = SpeechConfig.fromSubscription(speechKey, region);
    speechConfig.speechSynthesisOutputFormat = this.getAzureOutputFormat(options.format);

    const synthesizer = new SpeechSynthesizer(speechConfig, AudioConfig.fromDefaultSpeakerOutput());

    const ssml = this.buildSSML(text, options);

    // 使用事件方式获取流式输出
    const chunks: Buffer[] = [];
    
    synthesizer.synthesisStarted = (s: any, e: any) => {
      // 开始合成
    };

    synthesizer.audioDataStream = (s: any, e: any) => {
      // 音频数据流
    };

    // 注意: Azure SDK 流式输出需要特殊处理
    // 这里简化处理，实际使用时可能需要更复杂的实现
    
    const result = await new Promise<Buffer>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (res: any) => {
          synthesizer.close();
          if (res.errorDetails) {
            reject(new Error(res.errorDetails));
          } else {
            resolve(Buffer.from(res.audioData));
          }
        },
        (error: any) => {
          synthesizer.close();
          reject(error);
        }
      );
    });

    yield result;
  }

  // ============== OpenAI TTS 实现 ==============

  private async synthesizeWithOpenAI(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): Promise<Buffer> {
    const { OpenAI } = require('openai');
    
    const openai = new OpenAI({
      apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.config.endpoint || undefined,
    });

    const response = await openai.audio.speech.create({
      model: options.model || 'tts-1-hd',
      voice: this.mapVoiceToOpenAI(options.voice),
      input: text,
      response_format: options.format === 'mp3' ? 'mp3' : options.format,
      speed: options.speed || 1.0,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  }

  private async *synthesizeStreamOpenAI(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): AsyncGenerator<Buffer, void, unknown> {
    const { OpenAI } = require('openai');
    
    const openai = new OpenAI({
      apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
    });

    // OpenAI TTS 目前不支持流式输出
    // 降级为普通模式
    const buffer = await this.synthesizeWithOpenAI(text, options);
    yield buffer;
  }

  // ============== Edge TTS 实现 ==============

  private async synthesizeWithEdge(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): Promise<Buffer> {
    const EdgeTTS = require('edge-tts');
    
    const voice = this.mapVoiceToEdge(options.voice);
    
    const communicate = new EdgeTTS.Communicate(text, voice);
    
    // 收集所有音频块
    const chunks: Buffer[] = [];
    
    await new Promise<void>((resolve, reject) => {
      communicate.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      communicate.on('end', () => {
        resolve();
      });
      
      communicate.on('error', (error: Error) => {
        reject(error);
      });
    });

    // Edge TTS 输出为 webm 格式，需要转换
    // 简化处理: 直接返回 webm 格式数据
    return Buffer.concat(chunks);
  }

  private async *synthesizeStreamEdge(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): AsyncGenerator<Buffer, void, unknown> {
    const EdgeTTS = require('edge-tts');
    
    const voice = this.mapVoiceToEdge(options.voice);
    const communicate = new EdgeTTS.Communicate(text, voice);

    await new Promise<void>((resolve, reject) => {
      communicate.on('data', (chunk: Buffer) => {
        // 流式输出每个块
      });
      
      communicate.on('end', () => {
        resolve();
      });
      
      communicate.on('error', (error: Error) => {
        reject(error);
      });
    });

    // Edge TTS 支持流式输出
    // 实际实现需要使用更底层的 API
  }

  // ============== Coqui TTS 实现 ==============

  private async synthesizeWithCoqui(
    text: string,
    options: TTSOptions & { voice: string; format: string }
  ): Promise<Buffer> {
    // Coqui TTS 需要本地模型
    // 这里简化为占位实现
    this.ttsLogger.warn('Coqui TTS 需要本地模型部署');
    
    throw new Error('Coqui TTS 需要额外的模型配置，请使用其他提供商');
  }

  // ============== 辅助方法 ==============

  private buildSSML(text: string, options: TTSOptions & { voice: string }): string {
    const pitch = options.pitch !== undefined ? `${options.pitch}` : '+0st';
    const rate = options.speed !== undefined ? `${(options.speed - 1) * 100 + 100}%` : '100%';
    const volume = options.volume !== undefined ? `${options.volume * 100}%` : '100%';
    
    let voice = `<voice name="${options.voice}">`;
    
    // 解析语言代码
    const langCode = options.voice.split('-')[0] + '-' + options.voice.split('-')[1];
    
    return `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langCode}">
  <prosody pitch="${pitch}" rate="${rate}" volume="${volume}">
    ${options.enableSSML ? text : this.escapeXml(text)}
  </prosody>
</speak>
    `.trim();
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getAzureOutputFormat(format: string): any {
    const formatMap: Record<string, any> = {
      'mp3': require('@azure/cognitiveservices-speech-sdk').SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3,
      'wav': require('@azure/cognitiveservices-speech-sdk').SpeechSynthesisOutputFormat.Riff16Khz16KbpsMonoWav,
      'ogg': require('@azure/cognitiveservices-speech-sdk').SpeechSynthesisOutputFormat.Ogg16Khz16KbpsMonoOpus,
    };
    
    return formatMap[format] || formatMap['mp3'];
  }

  private mapVoiceToOpenAI(voice: string): string {
    const voiceMap: Record<string, string> = {
      // 中文
      'zh-CN-XiaoxiaoNeural': 'alloy',
      'zh-CN-YunxiNeural': 'onyx',
      // 英文
      'en-US-JennyNeural': 'alloy',
      'en-US-GuyNeural': 'onyx',
      'en-US-AriaNeural': 'shimmer',
      // 默认
    };
    
    return voiceMap[voice] || 'alloy';
  }

  private mapVoiceToEdge(voice: string): string {
    // Edge TTS 语音映射
    return voice;
  }

  /**
   * 估算字符费用
   */
  estimateCost(textLength: number, provider?: TTSProvider): number {
    const rates: Record<TTSProvider, number> = {
      'azure': 0.001,    // 每千字符约 $0.001
      'openai': 0.003,   // 每千字符约 $0.003 (HD)
      'edge': 0,         // 免费
      'coqui': 0,        // 开源免费
    };
    
    const providerRate = provider || this.config.provider;
    return (textLength / 1000) * rates[providerRate];
  }
}

// ============== 单例导出 ==============

let ttsServiceInstance: TTSService | null = null;

export function getTTSService(config?: Partial<TTSConfig>): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService(config);
  }
  return ttsServiceInstance;
}

export const ttsService = getTTSService();

export default ttsService;
```

### 3. TTS 路由实现

```typescript
// server/routes/tts.ts
import { Router, Request, Response } from 'express';
import { ttsService, VOICE_PRESETS, TTSOptions } from '../services/ttsService';
import { logger } from '../lib/logger';

const router = Router();
const ttsLogger = logger.category('tts-route');

// ============== 类型定义 ==============

interface SynthesizeRequest {
  text: string;
  voice?: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'opus';
  speed?: number;
  pitch?: number;
  volume?: number;
  enableSSML?: boolean;
}

interface BatchSynthesizeRequest {
  texts: string[];
  voice?: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'opus';
}

// ============== 路由处理 ==============

/**
 * GET /api/tts/voices
 * 获取可用音色列表
 */
router.get('/voices', (req: Request, res: Response) => {
  try {
    const { language } = req.query;
    const voices = ttsService.getVoices(language as string);

    res.json({
      success: true,
      voices,
      languages: Object.keys(VOICE_PRESETS),
    });
  } catch (error) {
    ttsLogger.error('获取音色列表失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/tts/synthesize
 * 语音合成
 */
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice, format, speed, pitch, volume, enableSSML } = req.body as SynthesizeRequest;

    // 验证必填参数
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '文本不能为空',
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '文本必须是字符串',
      });
    }

    ttsLogger.info('收到语音合成请求', {
      textLength: text.length,
      voice,
      format,
    });

    const options: TTSOptions = {
      voice,
      format: format as TTSOptions['format'],
      speed: speed ? parseFloat(String(speed)) : undefined,
      pitch: pitch ? parseFloat(String(pitch)) : undefined,
      volume: volume ? parseFloat(String(volume)) : undefined,
      enableSSML: enableSSML === true,
    };

    const result = await ttsService.synthesize(text, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // 估算费用
    const cost = ttsService.estimateCost(result.charactersUsed || text.length);

    // 设置响应头
    const contentTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'opus': 'audio/opus',
    };

    const contentType = contentTypes[result.audioFormat || 'mp3'];
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="tts_${Date.now()}.${result.audioFormat || 'mp3'}"`);
    res.setHeader('X-Audio-Duration', String(result.duration || ''));
    res.setHeader('X-Characters-Used', String(result.charactersUsed || ''));
    res.setHeader('X-Estimated-Cost', String(cost));

    res.json({
      success: true,
      audio: result.audioBuffer?.toString('base64'),
      audioFormat: result.audioFormat,
      duration: result.duration,
      charactersUsed: result.charactersUsed,
      estimatedCost: cost,
    });

  } catch (error) {
    ttsLogger.error('语音合成失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/tts/synthesize/stream
 * 流式语音合成
 */
router.post('/synthesize/stream', async (req: Request, res: Response) => {
  try {
    const { text, voice, format, speed, pitch, volume } = req.body as SynthesizeRequest;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: '文本不能为空',
      });
    }

    const options: TTSOptions = {
      voice,
      format: format as TTSOptions['format'],
      speed: speed ? parseFloat(String(speed)) : undefined,
      pitch: pitch ? parseFloat(String(pitch)) : undefined,
      volume: volume ? parseFloat(String(volume)) : undefined,
    };

    // 设置流式响应头
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 流式写入
    for await (const chunk of ttsService.synthesizeStream(text, options)) {
      res.write(chunk);
    }

    res.end();

  } catch (error) {
    ttsLogger.error('流式语音合成失败', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
});

/**
 * POST /api/tts/batch
 * 批量语音合成
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { texts, voice, format } = req.body as BatchSynthesizeRequest;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '文本列表不能为空',
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({
        success: false,
        error: '批量合成数量不能超过100条',
      });
    }

    ttsLogger.info('收到批量语音合成请求', {
      count: texts.length,
      voice,
    });

    const results = await Promise.allSettled(
      texts.map(text => ttsService.synthesize(text, { voice, format: format as TTSOptions['format'] }))
    );

    const successResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.success)
      .map((r, index) => ({
        index,
        success: true,
        audioBuffer: r.value.audioBuffer?.toString('base64'),
        audioFormat: r.value.audioFormat,
      }));

    const failedCount = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    res.json({
      success: true,
      total: texts.length,
      successCount: successResults.length,
      failedCount,
      results: successResults,
    });

  } catch (error) {
    ttsLogger.error('批量语音合成失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/tts/cost
 * 估算费用
 */
router.post('/cost', (req: Request, res: Response) => {
  try {
    const { textLength, provider } = req.body;
    
    if (!textLength || typeof textLength !== 'number') {
      return res.status(400).json({
        success: false,
        error: '请提供有效的文本长度',
      });
    }

    const cost = ttsService.estimateCost(textLength, provider);

    res.json({
      success: true,
      textLength,
      estimatedCost: cost,
      provider: provider || 'default',
    });
  } catch (error) {
    ttsLogger.error('费用估算失败', error);
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
import ttsRouter from './tts';

// 注册 TTS 路由
app.use(`${apiPrefix}/tts`, ttsRouter);
```

## 文件结构

```
server/
├── services/
│   ├── ttsService.ts          # TTS 服务 (新增)
│   └── videoService.ts        # 视频压缩服务 (已有)
├── routes/
│   ├── tts.ts                # TTS 路由 (新增)
│   └── video.ts              # 视频压缩路由 (已有)
└── config/
    └── env.ts                # 配置 (需添加 TTS 配置)
```

## 环境变量配置

```env
# TTS 配置
TTS_PROVIDER=azure             # azure | openai | edge | coqui
TTS_API_KEY=                   # API 密钥
AZURE_SPEECH_KEY=              # Azure 语音密钥
AZURE_SPEECH_REGION=eastus     # Azure 区域
OPENAI_API_KEY=                # OpenAI API 密钥

# 默认设置
TTS_DEFAULT_VOICE=zh-CN-XiaoxiaoNeural
TTS_DEFAULT_FORMAT=mp3
TTS_MAX_TEXT_LENGTH=10000
TTS_MAX_CONCURRENT=10
TTS_TEMP_DIR=./temp/tts
```

## API 参考

### 1. 获取可用音色

```
GET /api/tts/voices
Query:
  - language: zh-CN | en-US | ja-JP | ko-KR (可选)

Response:
{
  "success": true,
  "voices": [
    {
      "id": "zh-CN-XiaoxiaoNeural",
      "name": "晓晓",
      "gender": "female",
      "language": "中文",
      "languageCode": "zh-CN",
      "description": "标准女声"
    },
    ...
  ],
  "languages": ["zh-CN", "en-US", "ja-JP", "ko-KR"]
}
```

### 2. 语音合成

```
POST /api/tts/synthesize
Content-Type: application/json

Body:
{
  "text": "你好，这是一段测试语音",
  "voice": "zh-CN-XiaoxiaoNeural",  // 可选
  "format": "mp3",                    // 可选: mp3 | wav | ogg | opus
  "speed": 1.0,                       // 可选: 0.25 - 4.0
  "pitch": 1.0,                       // 可选: 0.5 - 2.0
  "volume": 1.0,                       // 可选: 0.0 - 1.0
  "enableSSML": false                  // 可选: 是否启用 SSML
}

Response:
{
  "success": true,
  "audio": "<base64 audio data>",
  "audioFormat": "mp3",
  "duration": 1500,
  "charactersUsed": 10,
  "estimatedCost": 0.00001
}
```

### 3. 流式语音合成

```
POST /api/tts/synthesize/stream
Content-Type: application/json

Body: (同上)

Response: (流式二进制音频数据)
```

### 4. 批量语音合成

```
POST /api/tts/batch
Content-Type: application/json

Body:
{
  "texts": [
    "第一条语音",
    "第二条语音",
    "第三条语音"
  ],
  "voice": "zh-CN-XiaoxiaoNeural",
  "format": "mp3"
}

Response:
{
  "success": true,
  "total": 3,
  "successCount": 3,
  "failedCount": 0,
  "results": [
    { "index": 0, "success": true, "audioBuffer": "...", "audioFormat": "mp3" },
    { "index": 1, "success": true, "audioBuffer": "...", "audioFormat": "mp3" },
    { "index": 2, "success": true, "audioBuffer": "...", "audioFormat": "mp3" }
  ]
}
```

### 5. 费用估算

```
POST /api/tts/cost
Content-Type: application/json

Body:
{
  "textLength": 1000,
  "provider": "azure"  // 可选
}

Response:
{
  "success": true,
  "textLength": 1000,
  "estimatedCost": 0.001,
  "provider": "azure"
}
```

## 费用说明

| 提供商 | 价格 (每千字符) | 免费额度 |
|--------|-----------------|----------|
| Azure | ~$0.001 | $200/月 (语音服务) |
| OpenAI TTS-1 | ~$0.003 | $5 免费额度 |
| Edge TTS | 免费 | 无限制 |
| Coqui TTS | 免费 | 需要本地部署 |

## 性能优化建议

1. **缓存热门文本**: 对常见文本进行缓存，避免重复合成
2. **异步处理**: 批量任务使用消息队列异步处理
3. **流式输出**: 实时场景使用流式输出减少首字节延迟
4. **并发控制**: 限制同时合成任务数，避免资源耗尽
5. **CDN 加速**: 合成后的音频可上传至 CDN 分发

## 错误处理

| 错误类型 | 错误码 | 说明 |
|---------|-------|------|
| TEXT_EMPTY | 400 | 文本不能为空 |
| TEXT_TOO_LONG | 400 | 文本长度超过限制 |
| VOICE_NOT_FOUND | 400 | 指定的音色不存在 |
| FORMAT_NOT_SUPPORTED | 400 | 不支持的音频格式 |
| PROVIDER_ERROR | 500 | TTS 提供商错误 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 |
| API_KEY_INVALID | 401 | API 密钥无效 |

## 安全注意事项

1. **API 密钥保护**: 不要在客户端暴露 API 密钥
2. **文本过滤**: 对输入文本进行敏感词过滤
3. **速率限制**: 限制单用户请求频率
4. **用量监控**: 监控 API 调用量和费用
5. **日志审计**: 记录合成请求用于审计追踪
6. **内容审核**: 对合成内容进行必要的审核

## SSML 使用示例

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
  <!-- 强调 -->
  <prosody pitch="+2st">这个很重要！</prosody>
  
  <!-- 暂停 -->
  <p>这是第一句。<break time="500ms"/>这是第二句。</p>
  
  <!-- 语速调节 -->
  <prosody rate="0.8">慢速朗读</prosody>
  
  <!-- 语音选择 -->
  <voice name="zh-CN-YunxiNeural">
    切换到男声
  </voice>
</speak>
```

## 客户端使用示例

```typescript
// 前端调用
const response = await fetch('/api/tts/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '你好，欢迎使用语音合成服务',
    voice: 'zh-CN-XiaoxiaoNeural',
    format: 'mp3',
    speed: 1.0
  })
});

const { audio, audioFormat } = await response.json();
const audioBlob = new Blob(
  [Uint8Array.from(atob(audio), c => c.charCodeAt(0))], 
  { type: `audio/${audioFormat}` }
);
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
```

```typescript
// 使用流式 API (更低的延迟)
const response = await fetch('/api/tts/synthesize/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: '实时语音播报' })
});

const reader = response.body?.getReader();
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamDestination();

// 流式播放
while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  // 处理音频数据块
}
```
