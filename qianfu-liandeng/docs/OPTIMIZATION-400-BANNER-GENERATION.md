# 优化项 400: 图像生成 - 服务器Banner

## 概述

为服务器列表页面集成 AI 图像生成功能，自动生成精美的服务器 Banner 封面图。解决用户上传 Banner 质量参差不齐、缺乏吸引力的问题，提升服务器列表页面的视觉吸引力和用户体验。

## 功能特性

1. **AI Banner 生成**: 根据服务器信息自动生成高质量 Banner
2. **多样化风格**: 支持多种生成风格（写实、像素、赛博朋克、水墨等）
3. **模板系统**: 预设多种 Banner 模板，支持主题定制
4. **缓存优化**: 生成结果自动缓存，避免重复生成
5. **降级策略**: API 不可用时优雅降级到默认 Banner
6. **CDN 集成**: 生成后自动上传到 CDN，提升加载速度

## 技术方案

### 1. 依赖安装

```bash
# 安装 OpenAI SDK (图像生成)
npm install openai

# 安装图像处理依赖 (已在 uploadService 中使用)
npm install sharp

# 安装缓存依赖 (如需使用 Redis)
npm install ioredis
```

### 2. 图像生成服务

```typescript
// server/services/bannerService.ts
import OpenAI from 'openai';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';
import { config as appConfig } from '../config/env';

// ============== 类型定义 ==============

export interface BannerStyle {
  id: string;
  name: string;
  prompt: string;  // 英文提示词
  description: string;
}

export interface BannerGenerationOptions {
  /** 服务器名称 */
  serverName: string;
  /** 服务器类型/游戏类型 */
  gameType?: string;
  /** 服务器描述 */
  description?: string;
  /** Banner 风格 */
  style?: string;
  /** 尺寸: '16:9' | '21:9' | '4:3' */
  aspectRatio?: '16:9' | '21:9' | '4:3';
}

export interface BannerGenerationResult {
  /** Banner ID */
  id: string;
  /** CDN URL */
  url: string;
  /** 本地路径 */
  path: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 生成风格 */
  style: string;
  /** 生成时间 */
  generatedAt: Date;
  /** 是否来自缓存 */
  fromCache: boolean;
}

export interface BannerStyleConfig {
  /** 默认风格 */
  defaultStyle: string;
  /** 可用风格列表 */
  styles: BannerStyle[];
  /** 尺寸配置 */
  sizes: {
    width: number;
    height: number;
  }[];
}

// ============== Banner 风格定义 ==============

export const BANNER_STYLES: BannerStyle[] = [
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    prompt: 'Epic cyberpunk gaming server banner, {server_name} theme, neon lights, futuristic cityscape, dark atmosphere with vibrant colors, holographic elements, digital rain, dramatic lighting, highly detailed, 4K',
    description: '科技感十足的赛博朋克风格，适合科幻类游戏服务器',
  },
  {
    id: 'fantasy',
    name: '魔幻史诗',
    prompt: 'Magnificent fantasy RPG server banner, {server_name} theme, ancient castle on floating islands, magical atmosphere, epic landscape, glowing runes, ethereal lighting, detailed illustrations, 4K',
    description: '魔幻风格的史诗场景，适合 RPG 游戏服务器',
  },
  {
    id: 'pixel-art',
    name: '像素艺术',
    prompt: 'Retro pixel art game server banner, {server_name} theme, 16-bit style, colorful pixel landscape, nostalgic gaming vibes, vibrant colors, charming details, 4K',
    description: '复古像素风格，适合像素类或经典游戏服务器',
  },
  {
    id: 'realistic',
    name: '写实自然',
    prompt: 'Stunning realistic nature gaming banner, {server_name} theme, beautiful landscape, mountains and forests, golden hour lighting, cinematic composition, highly detailed, 4K',
    description: '写实自然风景风格，适合生存、建造类游戏服务器',
  },
  {
    id: 'anime',
    name: '动漫风格',
    prompt: 'Beautiful anime style game server banner, {server_name} theme, vibrant anime art style, colorful characters, dynamic composition, cel-shaded, Japanese animation aesthetic, 4K',
    description: '二次元动漫风格，适合社交、休闲游戏服务器',
  },
  {
    id: 'medieval',
    name: '中世纪',
    prompt: 'Epic medieval fantasy server banner, {server_name} theme, medieval fortress, knights, flags, stone walls, torches, dramatic sky, dark fantasy atmosphere, highly detailed, 4K',
    description: '中世纪骑士风格，适合 MMO、战争类游戏服务器',
  },
  {
    id: 'scifi',
    name: '科幻太空',
    prompt: 'Breathtaking sci-fi space server banner, {server_name} theme, cosmic nebula, space station, planets, stars, alien planet surface, futuristic technology, cinematic lighting, 4K',
    description: '太空科幻风格，适合科幻类、太空探索游戏服务器',
  },
  {
    id: 'watercolor',
    name: '水墨风格',
    prompt: 'Elegant Chinese ink wash painting style game banner, {server_name} theme, traditional Chinese art, mountains, mist, flowing water, minimalist composition, serene atmosphere, 4K',
    description: '中国水墨画风格，适合武侠、国风游戏服务器',
  },
];

// ============== 默认配置 ==============

const DEFAULT_CONFIG: BannerStyleConfig = {
  defaultStyle: 'fantasy',
  styles: BANNER_STYLES,
  sizes: [
    { width: 1920, height: 1080 },  // 16:9
    { width: 2520, height: 1080 },  // 21:9
    { width: 1440, height: 1080 }, // 4:3
  ],
};

// ============== Banner 生成服务 ==============

export class BannerService {
  private openai: OpenAI | null = null;
  private bannerLogger: ReturnType<typeof logger.category>;
  private cache: Map<string, BannerGenerationResult>;
  private storageDir: string;
  private cdnPrefix: string;
  private defaultBannerUrl: string;

  constructor(options?: {
    storageDir?: string;
    cdnPrefix?: string;
    defaultBannerUrl?: string;
  }) {
    this.bannerLogger = logger.category('banner');

    // 初始化 OpenAI 客户端
    const apiKey = appConfig.ai.openaiApiKey;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: appConfig.ai.openaiBaseUrl,
      });
      this.bannerLogger.info('OpenAI 客户端已初始化');
    } else {
      this.bannerLogger.warn('未配置 OPENAI_API_KEY，AI Banner 生成功能不可用');
    }

    // 初始化配置
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'uploads', 'banners');
    this.cdnPrefix = options?.cdnPrefix || '/cdn/banners';
    this.defaultBannerUrl = options?.defaultBannerUrl || '/default-banner.jpg';

    // 内存缓存 (生产环境建议使用 Redis)
    this.cache = new Map();

    // 确保存储目录存在
    this.ensureStorageDir();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    const { existsSync, mkdirSync } = require('fs');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * 生成缓存 Key
   */
  private generateCacheKey(options: BannerGenerationOptions): string {
    const data = `${options.serverName}|${options.gameType || ''}|${options.style || 'default'}|${options.aspectRatio || '16:9'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 获取风格配置
   */
  private getStyleConfig(styleId: string): BannerStyle {
    const style = BANNER_STYLES.find((s) => s.id === styleId);
    return style || BANNER_STYLES[0];
  }

  /**
   * 获取尺寸配置
   */
  private getSizeConfig(aspectRatio: string): { width: number; height: number } {
    const size = DEFAULT_CONFIG.sizes.find((s) => {
      if (aspectRatio === '16:9') return s.width / s.height === 16 / 9;
      if (aspectRatio === '21:9') return s.width / s.height === 21 / 9;
      if (aspectRatio === '4:3') return s.width / s.height === 4 / 3;
      return false;
    });
    return size || DEFAULT_CONFIG.sizes[0];
  }

  /**
   * 构建生成提示词
   */
  private buildPrompt(options: BannerGenerationOptions): string {
    const style = this.getStyleConfig(options.style || DEFAULT_CONFIG.defaultStyle);
    let prompt = style.prompt.replace('{server_name}', options.serverName);

    if (options.gameType) {
      prompt += `, ${options.gameType} game theme`;
    }

    if (options.description) {
      prompt += `, ${options.description}`;
    }

    return prompt;
  }

  /**
   * 生成 Banner
   */
  async generateBanner(options: BannerGenerationOptions): Promise<BannerGenerationResult> {
    const { serverName, style, aspectRatio } = options;

    // 检查缓存
    const cacheKey = this.generateCacheKey(options);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.bannerLogger.debug('使用缓存的 Banner', { cacheKey });
      return { ...cached, fromCache: true };
    }

    // 检查 OpenAI 是否可用
    if (!this.openai) {
      this.bannerLogger.warn('OpenAI 不可用，返回默认 Banner');
      return {
        id: 'default',
        url: this.defaultBannerUrl,
        path: '',
        width: 1920,
        height: 1080,
        style: 'default',
        generatedAt: new Date(),
        fromCache: false,
      };
    }

    const startTime = Date.now();

    try {
      // 构建提示词
      const prompt = this.buildPrompt(options);
      const sizeConfig = this.getSizeConfig(aspectRatio || '16:9');

      this.bannerLogger.info('开始生成 Banner', {
        serverName,
        style,
        prompt: prompt.substring(0, 100) + '...',
      });

      // 调用 OpenAI API 生成图像
      const response = await this.openai.images.generate({
        model: 'dall-e-3',  // 或 'dall-e-2' 用于更快更便宜的生成
        prompt,
        n: 1,
        size: '1792x1024',  // DALL-E 3 支持的尺寸
        quality: 'standard',  // 'standard' 或 'hd'
        response_format: 'b64_json',  // 返回 base64
      });

      const base64Image = response.data[0].b64_json;
      if (!base64Image) {
        throw new Error('未收到图像数据');
      }

      // 解码并处理图像
      const imageBuffer = Buffer.from(base64Image, 'base64');

      // 调整到目标尺寸
      const processedBuffer = await sharp(imageBuffer)
        .resize(sizeConfig.width, sizeConfig.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })  // 转换为 WebP 格式
        .toBuffer();

      // 生成唯一 ID 和文件名
      const id = crypto.randomUUID();
      const filename = `${id}.webp`;
      const relativePath = path.join('banners', filename);
      const fullPath = path.join(this.storageDir, filename);

      // 保存文件
      await fs.writeFile(fullPath, processedBuffer);

      const result: BannerGenerationResult = {
        id,
        url: `${this.cdnPrefix}/${relativePath.replace(/\\/g, '/')}`,
        path: fullPath,
        width: sizeConfig.width,
        height: sizeConfig.height,
        style: style || DEFAULT_CONFIG.defaultStyle,
        generatedAt: new Date(),
        fromCache: false,
      };

      // 缓存结果
      this.cache.set(cacheKey, result);

      const duration = Date.now() - startTime;
      this.bannerLogger.info('Banner 生成成功', {
        id,
        serverName,
        style,
        durationMs: duration,
        size: processedBuffer.length,
      });

      return result;

    } catch (error) {
      this.bannerLogger.error('Banner 生成失败', error, { serverName, style });

      // 降级到默认 Banner
      return {
        id: 'default',
        url: this.defaultBannerUrl,
        path: '',
        width: 1920,
        height: 1080,
        style: 'default',
        generatedAt: new Date(),
        fromCache: false,
      };
    }
  }

  /**
   * 批量生成 Banner (带并发控制)
   */
  async generateBannersBatch(
    optionsList: BannerGenerationOptions[],
    concurrency = 3
  ): Promise<BannerGenerationResult[]> {
    const results: BannerGenerationResult[] = [];
    const chunks: BannerGenerationOptions[][] = [];

    // 分批处理
    for (let i = 0; i < optionsList.length; i += concurrency) {
      chunks.push(optionsList.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((options) => this.generateBanner(options))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 获取可用风格列表
   */
  getAvailableStyles(): BannerStyle[] {
    return DEFAULT_CONFIG.styles;
  }

  /**
   * 删除 Banner
   */
  async deleteBanner(id: string, style: string): Promise<void> {
    try {
      const filename = `${id}.webp`;
      const filepath = path.join(this.storageDir, filename);
      await fs.unlink(filepath);
      this.bannerLogger.debug('删除 Banner 文件', { id, filepath });
    } catch (error) {
      this.bannerLogger.warn('删除 Banner 文件失败', { id, error });
    }
  }

  /**
   * 清理过期缓存
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.bannerLogger.info('Banner 缓存已清理', { clearedItems: size });
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0,  // 需要额外实现计数器
    };
  }
}

// ============== 单例导出 ==============

let bannerServiceInstance: BannerService | null = null;

export function getBannerService(
  config?: ConstructorParameters<typeof BannerService>[0]
): BannerService {
  if (!bannerServiceInstance) {
    bannerServiceInstance = new BannerService(config);
  }
  return bannerServiceInstance;
}

export const bannerService = getBannerService();

export default bannerService;
```

### 3. Banner 路由

```typescript
// server/routes/banner.ts
import { Router, Request, Response, NextFunction } from 'express';
import { getBannerService, BannerGenerationOptions } from '../services/bannerService';
import { logger } from '../lib/logger';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const bannerLogger = logger.category('banner-route');

// ============== 辅助函数 ==============

function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message: message || '操作成功',
    data,
  };
}

// ============== 路由处理 ==============

/**
 * POST /api/banner/generate
 * 生成服务器 Banner
 */
router.post(
  '/generate',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        serverName,
        gameType,
        description,
        style,
        aspectRatio,
      } = req.body as BannerGenerationOptions & { aspectRatio?: '16:9' | '21:9' | '4:3' };

      // 参数验证
      if (!serverName || typeof serverName !== 'string') {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数: serverName',
        });
      }

      if (serverName.length > 100) {
        return res.status(400).json({
          success: false,
          error: '服务器名称过长，最大 100 字符',
        });
      }

      const bannerService = getBannerService();
      const result = await bannerService.generateBanner({
        serverName,
        gameType,
        description,
        style,
        aspectRatio,
      });

      bannerLogger.info('Banner 生成请求', {
        serverName,
        style,
        fromCache: result.fromCache,
      });

      return res.status(201).json(successResponse(result, 'Banner 生成成功'));

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/banner/generate/batch
 * 批量生成 Banner
 */
router.post(
  '/generate/batch',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { servers, concurrency = 3 } = req.body;

      if (!Array.isArray(servers) || servers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'servers 参数必须是非空数组',
        });
      }

      if (servers.length > 50) {
        return res.status(400).json({
          success: false,
          error: '单次最多生成 50 个 Banner',
        });
      }

      const bannerService = getBannerService();
      const optionsList: BannerGenerationOptions[] = servers.map(
        (server: any) => ({
          serverName: server.name,
          gameType: server.gameType,
          description: server.description,
          style: server.style,
          aspectRatio: server.aspectRatio,
        })
      );

      const results = await bannerService.generateBannersBatch(
        optionsList,
        Math.min(concurrency, 5)
      );

      bannerLogger.info('批量 Banner 生成完成', {
        total: servers.length,
        success: results.filter((r) => r.id !== 'default').length,
      });

      return res.status(201).json(
        successResponse({
          total: servers.length,
          results,
        })
      );

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/banner/styles
 * 获取可用风格列表
 */
router.get('/styles', (req: Request, res: Response) => {
  const bannerService = getBannerService();
  const styles = bannerService.getAvailableStyles();

  return res.json(
    successResponse({
      styles: styles.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
    })
  );
});

/**
 * DELETE /api/banner/:id
 * 删除 Banner (仅管理员)
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { style } = req.query;

      const bannerService = getBannerService();
      await bannerService.deleteBanner(id, style as string);

      return res.json(successResponse({ id }, 'Banner 删除成功'));

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/banner/stats
 * 获取缓存统计 (仅管理员)
 */
router.get(
  '/stats',
  requireAuth,
  requireRole('admin'),
  (req: Request, res: Response) => {
    const bannerService = getBannerService();
    const stats = bannerService.getCacheStats();

    return res.json(successResponse(stats));
  }
);

/**
 * POST /api/banner/cache/clear
 * 清空缓存 (仅管理员)
 */
router.post(
  '/cache/clear',
  requireAuth,
  requireRole('admin'),
  (req: Request, res: Response) => {
    const bannerService = getBannerService();
    bannerService.clearCache();

    return res.json(successResponse(null, '缓存已清空'));
  }
);

// ============== 错误处理 ==============

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  bannerLogger.error('Banner 路由错误', err);

  return res.status(500).json({
    success: false,
    error: '服务器内部错误，请稍后重试',
  });
});

export default router;
```

### 4. 配置更新

```typescript
// server/config/env.ts

// 添加 AI Config 中的图像生成配置
export interface AIConfig {
  // ... 现有配置
  /** DALL-E 模型 (dall-e-2 | dall-e-3) */
  dalleModel?: string;
  /** 图像生成质量 (standard | hd) */
  dalleQuality?: 'standard' | 'hd';
  /** Banner 默认风格 */
  bannerDefaultStyle?: string;
  /** Banner 默认尺寸 */
  bannerDefaultAspectRatio?: '16:9' | '21:9' | '4:3';
  /** 默认 Banner URL */
  bannerDefaultUrl?: string;
}

function buildAIConfig(): AIConfig {
  return {
    // ... 现有配置
    dalleModel: parseStringEnv(process.env.DALLE_MODEL || '', 'dall-e-3'),
    dalleQuality: (process.env.DALLE_QUALITY as 'standard' | 'hd') || 'standard',
    bannerDefaultStyle: parseStringEnv(process.env.BANNER_DEFAULT_STYLE || '', 'fantasy'),
    bannerDefaultAspectRatio: (process.env.BANNER_DEFAULT_ASPECT_RATIO as '16:9' | '21:9' | '4:3') || '16:9',
    bannerDefaultUrl: parseStringEnv(process.env.BANNER_DEFAULT_URL || '', '/default-banner.webp'),
  };
}
```

### 5. 路由注册

```typescript
// server/routes/index.ts
import bannerRouter from './banner';

// 注册 Banner 路由
app.use(`${apiPrefix}/banner`, bannerRouter);
```

## 文件结构

```
server/
├── services/
│   ├── uploadService.ts       # 图片压缩服务 (已有)
│   ├── videoService.ts        # 视频压缩服务 (已有)
│   └── bannerService.ts       # Banner 生成服务 (新增)
├── routes/
│   ├── upload.ts              # 图片上传路由 (已有)
│   ├── video.ts               # 视频压缩路由 (已有)
│   └── banner.ts              # Banner 生成路由 (新增)
└── config/
    └── env.ts                 # 配置 (需添加 Banner 配置)
```

## 环境变量配置

```env
# AI 图像生成配置
OPENAI_API_KEY=your_openai_api_key          # OpenAI API Key (必需)
OPENAI_BASE_URL=                           # OpenAI API Base URL (可选, 用于代理)
DALLE_MODEL=dall-e-3                       # DALL-E 模型 (dall-e-2 | dall-e-3)
DALLE_QUALITY=standard                     # 生成质量 (standard | hd)

# Banner 配置
BANNER_STORAGE_DIR=./uploads/banners        # Banner 存储目录
BANNER_CDN_PREFIX=/cdn/banners             # CDN 前缀
BANNER_DEFAULT_STYLE=fantasy                # 默认风格
BANNER_DEFAULT_ASPECT_RATIO=16:9            # 默认尺寸
BANNER_DEFAULT_URL=/default-banner.webp     # 默认 Banner URL
```

## API 参考

### 1. 生成 Banner

```
POST /api/banner/generate
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "serverName": "我的游戏服务器",      // 必需，服务器名称
  "gameType": "RPG",                   // 可选，游戏类型
  "description": "史诗级冒险",         // 可选，描述
  "style": "fantasy",                  // 可选，风格 (见 GET /api/banner/styles)
  "aspectRatio": "16:9"               // 可选，尺寸比例
}

Response:
{
  "success": true,
  "message": "Banner 生成成功",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "/cdn/banners/550e8400-e29b-41d4-a716-446655440000.webp",
    "width": 1920,
    "height": 1080,
    "style": "fantasy",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "fromCache": false
  }
}
```

### 2. 批量生成 Banner

```
POST /api/banner/generate/batch
Authorization: Bearer <token> (Admin only)
Content-Type: application/json

Body:
{
  "servers": [
    { "name": "服务器1", "gameType": "RPG", "style": "fantasy" },
    { "name": "服务器2", "gameType": "FPS", "style": "cyberpunk" },
    { "name": "服务器3", "gameType": "沙盒", "style": "realistic" }
  ],
  "concurrency": 3                      // 可选，并发数 (默认3)
}

Response:
{
  "success": true,
  "data": {
    "total": 3,
    "results": [
      { "id": "...", "url": "...", "style": "fantasy", ... },
      { "id": "...", "url": "...", "style": "cyberpunk", ... },
      { "id": "...", "url": "...", "style": "realistic", ... }
    ]
  }
}
```

### 3. 获取可用风格

```
GET /api/banner/styles

Response:
{
  "success": true,
  "data": {
    "styles": [
      { "id": "cyberpunk", "name": "赛博朋克", "description": "科技感十足的赛博朋克风格" },
      { "id": "fantasy", "name": "魔幻史诗", "description": "魔幻风格的史诗场景" },
      { "id": "pixel-art", "name": "像素艺术", "description": "复古像素风格" },
      { "id": "realistic", "name": "写实自然", "description": "写实自然风景风格" },
      { "id": "anime", "name": "动漫风格", "description": "二次元动漫风格" },
      { "id": "medieval", "name": "中世纪", "description": "中世纪骑士风格" },
      { "id": "scifi", "name": "科幻太空", "description": "太空科幻风格" },
      { "id": "watercolor", "name": "水墨风格", "description": "中国水墨画风格" }
    ]
  }
}
```

### 4. 删除 Banner

```
DELETE /api/banner/:id?style=fantasy
Authorization: Bearer <token> (Admin only)

Response:
{
  "success": true,
  "message": "Banner 删除成功",
  "data": { "id": "550e8400-e29b-41d4-a716-446655440000" }
}
```

### 5. 获取缓存统计

```
GET /api/banner/stats
Authorization: Bearer <token> (Admin only)

Response:
{
  "success": true,
  "data": {
    "size": 42,
    "hitRate": 0.65
  }
}
```

### 6. 清空缓存

```
POST /api/banner/cache/clear
Authorization: Bearer <token> (Admin only)

Response:
{
  "success": true,
  "message": "缓存已清空"
}
```

## 前端集成示例

```tsx
// src/components/ServerBannerGenerator.tsx
import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface BannerGeneratorProps {
  serverId: string;
  serverName: string;
  gameType?: string;
  currentBanner?: string;
  onBannerGenerated: (url: string) => void;
}

export function ServerBannerGenerator({
  serverId,
  serverName,
  gameType,
  currentBanner,
  onBannerGenerated,
}: BannerGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('fantasy');
  const [error, setError] = useState<string | null>(null);

  const styles = [
    { id: 'fantasy', name: '魔幻史诗' },
    { id: 'cyberpunk', name: '赛博朋克' },
    { id: 'pixel-art', name: '像素艺术' },
    { id: 'realistic', name: '写实自然' },
    { id: 'anime', name: '动漫风格' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/banner/generate', {
        serverName,
        gameType,
        style: selectedStyle,
      });

      if (response.success) {
        onBannerGenerated(response.data.url);
      }
    } catch (err) {
      setError('Banner 生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <img
          src={currentBanner || '/default-banner.webp'}
          alt="当前 Banner"
          className="w-full h-32 object-cover rounded-lg"
        />
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedStyle}
          onChange={(e) => setSelectedStyle(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          {styles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
        >
          {isGenerating ? '生成中...' : 'AI 生成 Banner'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
```

## 性能优化建议

1. **缓存策略**:
   - 使用 Redis 缓存生成结果，设置过期时间
   - 同一服务器名称+风格组合的请求直接返回缓存

2. **并发控制**:
   - 限制单用户批量生成数量 (建议 50 个)
   - 使用信号量控制 API 并发调用

3. **降级方案**:
   - OpenAI API 不可用时返回默认 Banner
   - 提供静态默认 Banner 模板

4. **图像优化**:
   - 生成后自动转换为 WebP 格式
   - 存储多个尺寸版本供不同场景使用
   - 设置合理的 CDN 缓存策略

5. **成本控制**:
   - 使用 DALL-E 2 生成低优先级请求
   - 关键请求使用 DALL-E 3 保证质量

## 安全注意事项

1. **提示词过滤**: 防止用户通过服务器名称注入恶意提示词
2. **内容审核**: 对生成的图像进行基本的内容安全检查
3. **速率限制**: 限制单个用户的生成频率
4. **权限控制**: 批量生成和管理操作仅限管理员
5. **API Key 安全**: 使用环境变量存储，不暴露在前端代码中

## 错误处理

| 错误类型 | 错误码 | 说明 |
|---------|-------|------|
| MISSING_PARAMETER | 400 | 缺少必需参数 |
| INVALID_STYLE | 400 | 无效的风格 ID |
| NAME_TOO_LONG | 400 | 服务器名称超过限制 |
| OPENAI_ERROR | 502 | OpenAI API 调用失败 |
| RATE_LIMITED | 429 | 请求频率超限 |
| UNAUTHORIZED | 401 | 未认证 |
| FORBIDDEN | 403 | 无权限 (批量操作需管理员) |

## 成本估算

| 模型 | 分辨率 | 单次成本 (约) |
|-----|-------|--------------|
| DALL-E 2 | 1024x1024 | $0.02 |
| DALL-E 2 | 512x512 | $0.018 |
| DALL-E 3 | 1024x1024 | $0.04 |
| DALL-E 3 | 1792x1024 | $0.08 |

建议:
- 普通用户生成: 使用 DALL-E 2
- 管理员预览: 使用 DALL-E 3
- 批量生成: 使用 DALL-E 2 + 升级处理
