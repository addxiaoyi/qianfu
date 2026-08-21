/**
 * 图片上传与压缩服务
 *
 * 功能:
 * - 图片格式检测与验证
 * - Sharp 高性能图片压缩 (JPEG, PNG, WebP, AVIF)
 * - 多尺寸生成 (原图、缩略图、中图、大图)
 * - 自动元数据提取
 * - CDN 路径生成
 * - 异步队列处理 (可选)
 *
 * 依赖:
 * - sharp: 高性能图片处理
 * - mime-types: MIME 类型检测
 *
 * 使用示例:
 * ```typescript
 * import { uploadService } from './services/uploadService';
 *
 * // 处理上传的图片
 * const result = await uploadService.processImage(buffer, {
 *   filename: 'avatar.jpg',
 *   mimeType: 'image/jpeg',
 * });
 *
 * // 获取 CDN URL
 * const cdnUrl = uploadService.getCdnUrl(result.key);
 * ```
 */

import sharp from 'sharp';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../lib/logger';
import { config as appConfig } from '../config/env';

// ============== 类型定义 ==============

export interface ImageSize {
  /** 尺寸标识 */
  name: 'thumbnail' | 'medium' | 'large' | 'original';
  /** 最大宽度 */
  width: number;
  /** 最大高度 */
  height: number;
  /** 质量 (1-100) */
  quality: number;
  /** 格式 */
  format: 'jpeg' | 'webp' | 'png' | 'avif';
  /** 是否启用 */
  enabled: boolean;
  /** WebP压缩级别 (1-6, 越高越小但越慢，默认4) */
  webpEffort?: number;
  /** 是否使用无损压缩 (仅WebP) */
  webpLossless?: boolean;
  /** 是否使用近无损压缩 (仅WebP) */
  webpNearLossless?: boolean;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  orientation?: number;
  density?: number;
  exif?: Record<string, unknown>;
}

export interface ProcessedImage {
  /** 唯一标识符 */
  id: string;
  /** 文件名 (不含路径) */
  filename: string;
  /** 原始文件名 */
  originalName: string;
  /** MIME 类型 */
  mimeType: string;
  /** 最终格式 */
  format: string;
  /** 原始大小 (字节) */
  originalSize: number;
  /** 处理后大小 (字节) */
  size: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 压缩率 (0-1, 越小压缩越多) */
  compressionRatio: number;
  /** 本地存储路径 */
  path: string;
  /** CDN 路径 */
  cdnPath: string;
  /** 各尺寸版本 */
  variants: ProcessedVariant[];
  /** 元数据 */
  metadata: ImageMetadata;
  /** 创建时间 */
  createdAt: Date;
}

export interface ProcessedVariant {
  /** 尺寸名称 */
  name: string;
  /** 文件路径 */
  path: string;
  /** CDN 路径 */
  cdnPath: string;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 文件大小 */
  size: number;
}

export interface ProcessOptions {
  /** 文件名 */
  filename?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 目标格式 ('original'表示保持原格式) */
  format?: 'jpeg' | 'webp' | 'png' | 'avif' | 'original';
  /** 是否生成缩略图 */
  generateVariants?: boolean;
  /** 自定义尺寸配置 */
  customSizes?: Partial<ImageSize>[];
  /** 压缩质量 (1-100) */
  quality?: number;
  /** 最大尺寸 (宽度或高度) */
  maxSize?: number;
  /** 保留元数据 */
  preserveMetadata?: boolean;
  /** 是否去除 EXIF */
  stripExif?: boolean;
  /** 存储目录 */
  storageDir?: string;
  /** CDN 前缀 */
  cdnPrefix?: string;
  /** WebP压缩级别 (1-6) */
  webpEffort?: number;
  /** WebP无损压缩 */
  webpLossless?: boolean;
  /** WebP近无损压缩 */
  webpNearLossless?: boolean;
}

export interface UploadConfig {
  /** 存储目录 */
  storageDir: string;
  /** CDN 前缀 */
  cdnPrefix: string;
  /** 允许的 MIME 类型 */
  allowedMimeTypes: string[];
  /** 最大文件大小 (字节) */
  maxFileSize: number;
  /** 默认压缩质量 */
  defaultQuality: number;
  /** 是否启用 AVIF (兼容性较差) */
  enableAvif: boolean;
  /** 图片尺寸配置 */
  sizes: ImageSize[];
  /** 存储策略 */
  storageStrategy: 'local' | 's3' | 'oss';
  /** S3/OSS 配置 */
  cloudConfig?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
}

// ============== 默认配置 ==============

const DEFAULT_CONFIG: UploadConfig = {
  storageDir: appConfig.upload.storageDir,
  cdnPrefix: appConfig.upload.cdnPrefix,
  allowedMimeTypes: appConfig.upload.allowedMimeTypes,
  maxFileSize: appConfig.upload.maxFileSize,
  defaultQuality: appConfig.upload.defaultQuality,
  enableAvif: appConfig.upload.enableAvif,
  sizes: [
    { name: 'thumbnail', width: 200, height: 200, quality: 70, format: 'webp', enabled: true, webpEffort: 4, webpNearLossless: false },
    { name: 'medium', width: 800, height: 800, quality: 80, format: 'webp', enabled: true, webpEffort: 4, webpNearLossless: false },
    { name: 'large', width: 1920, height: 1920, quality: 85, format: 'webp', enabled: true, webpEffort: 4, webpNearLossless: false },
    { name: 'original', width: 0, height: 0, quality: 90, format: 'webp', enabled: true, webpEffort: 4, webpNearLossless: false },
  ],
  storageStrategy: 'local',
};

// ============== 工具函数 ==============

/**
 * 生成唯一文件名
 */
function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}_${random}`;
}

/**
 * 从文件名获取扩展名
 */
function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext.replace('.', '') || 'jpg';
}

/**
 * 验证 MIME 类型
 */
function isValidImageMimeType(mimeType: string, allowed: string[]): boolean {
  return allowed.includes(mimeType);
}

/**
 * 获取 Sharp 格式
 */
function getSharpFormat(format: string): keyof sharp.FormatEnum {
  const formatMap: Record<string, keyof sharp.FormatEnum> = {
    jpeg: 'jpeg',
    jpg: 'jpeg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
    tiff: 'tiff',
    bmp: 'bmp',
    gif: 'gif',
  };
  return formatMap[format.toLowerCase()] || 'jpeg';
}

/**
 * 获取 MIME 类型
 */
function getMimeType(format: string): string {
  const mimeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    tiff: 'image/tiff',
    bmp: 'image/bmp',
    gif: 'image/gif',
  };
  return mimeMap[format.toLowerCase()] || 'image/jpeg';
}

/**
 * 计算压缩率
 */
function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 1;
  return compressed / original;
}

/**
 * 获取WebP压缩选项
 */
function getWebpOptions(effort?: number, lossless?: boolean, nearLossless?: boolean, quality?: number): sharp.WebpOptions {
  return {
    quality: lossless ? 100 : quality,
    effort: effort ?? 4,  // 默认压缩级别4，范围1-6
    lossless: lossless ?? false,
    nearLossless: nearLossless ?? false,
  };
}

// ============== 图片压缩服务 ==============

export class UploadService {
  private config: UploadConfig;
  private uploadLogger: ReturnType<typeof logger.category>;

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.uploadLogger = logger.category('upload');

    // 确保存储目录存在
    this.ensureStorageDir();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (this.config.storageStrategy === 'local') {
      const dirs = [
        this.config.storageDir,
        path.join(this.config.storageDir, 'original'),
        path.join(this.config.storageDir, 'thumbnail'),
        path.join(this.config.storageDir, 'medium'),
        path.join(this.config.storageDir, 'large'),
      ];

      dirs.forEach((dir) => {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      });
    }
  }

  /**
   * 格式转换 (统一处理，支持WebP高级参数)
   */
  private async convertFormat(
    sharpInstance: sharp.Sharp,
    format: string,
    options: {
      quality?: number;
      webpEffort?: number;
      webpLossless?: boolean;
      webpNearLossless?: boolean;
    }
  ): Promise<Buffer> {
    const { quality, webpEffort, webpLossless, webpNearLossless } = options;
    const sharpFormat = getSharpFormat(format);

    if (sharpFormat === 'webp') {
      // WebP格式使用高级参数
      return sharpInstance.webp(getWebpOptions(webpEffort, webpLossless, webpNearLossless, quality)).toBuffer();
    } else if (sharpFormat === 'jpeg') {
      // JPEG使用渐进式加载
      return sharpInstance.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
    } else if (sharpFormat === 'avif') {
      // AVIF格式
      return sharpInstance.avif({ quality, effort: webpEffort ?? 4 }).toBuffer();
    } else {
      // PNG等格式
      return sharpInstance.toFormat(sharpFormat, { quality }).toBuffer();
    }
  }

  /**
   * 验证上传文件
   */
  validateFile(
    buffer: Buffer,
    mimeType: string
  ): { valid: boolean; error?: string } {
    // 检查文件大小
    if (buffer.length > this.config.maxFileSize) {
      return {
        valid: false,
        error: `文件大小超过限制 (最大 ${this.config.maxFileSize / 1024 / 1024}MB)`,
      };
    }

    // 检查 MIME 类型
    if (!isValidImageMimeType(mimeType, this.config.allowedMimeTypes)) {
      return {
        valid: false,
        error: `不支持的图片格式: ${mimeType}`,
      };
    }

    return { valid: true };
  }

  /**
   * 获取图片元数据
   */
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation,
      density: metadata.density,
      exif: metadata.exif
        ? { hasExif: true }
        : undefined,
    };
  }

  /**
   * 处理图片 - 压缩 + 生成多尺寸
   */
  async processImage(
    buffer: Buffer,
    options: ProcessOptions = {}
  ): Promise<ProcessedImage> {
    const {
      filename = 'image.jpg',
      mimeType = 'image/jpeg',
      format = 'webp',  // 默认改为WebP
      generateVariants = true,
      quality = this.config.defaultQuality,
      maxSize = 4096,
      preserveMetadata = false,
      stripExif = true,
      storageDir = this.config.storageDir,
      cdnPrefix = this.config.cdnPrefix,
      webpEffort = 4,
      webpLossless = false,
      webpNearLossless = false,
    } = options;

    const startTime = Date.now();
    const uniqueId = generateUniqueId();
    const originalExt = getExtension(filename);
    const targetFormat = format === 'original' ? originalExt : format;

    this.uploadLogger.debug('开始处理图片', {
      filename,
      mimeType,
      format: targetFormat,
      size: buffer.length,
    });

    // 验证文件
    const validation = this.validateFile(buffer, mimeType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 获取元数据
    const originalMetadata = await this.getMetadata(buffer);

    // 如果原始图片已经小于目标尺寸且不需要格式转换，直接保存
    const needsProcessing =
      originalMetadata.width > maxSize ||
      originalMetadata.height > maxSize ||
      originalMetadata.format !== targetFormat;

    let processedBuffer: Buffer;
    let finalWidth = originalMetadata.width;
    let finalHeight = originalMetadata.height;
    let finalFormat = targetFormat;

    if (needsProcessing) {
      // 创建 Sharp 实例并处理
      let sharpInstance = sharp(buffer);

      // 调整尺寸 (保持宽高比)
      if (originalMetadata.width > maxSize || originalMetadata.height > maxSize) {
        sharpInstance = sharpInstance.resize(maxSize, maxSize, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // 去除 EXIF (除非需要保留)
      if (stripExif) {
        sharpInstance = sharpInstance.withMetadata({ orientation: undefined });
      } else if (preserveMetadata) {
        sharpInstance = sharpInstance.withMetadata();
      }

      // 压缩格式转换 - 统一处理所有格式
      processedBuffer = await this.convertFormat(sharpInstance, targetFormat, {
        quality,
        webpEffort,
        webpLossless,
        webpNearLossless,
      });

      // 获取处理后的尺寸
      const processedMeta = await sharp(processedBuffer).metadata();
      finalWidth = processedMeta.width || originalMetadata.width;
      finalHeight = processedMeta.height || originalMetadata.height;
    } else {
      // 无需处理，直接复制
      processedBuffer = buffer;
    }

    // 生成唯一文件名
    const newFilename = `${uniqueId}.${finalFormat}`;
    const relativePath = path.join('original', newFilename);
    const fullPath = path.join(storageDir, relativePath);

    // 保存原图
    await fs.writeFile(fullPath, processedBuffer);

    // 构建结果
    const result: ProcessedImage = {
      id: uniqueId,
      filename: newFilename,
      originalName: filename,
      mimeType: getMimeType(finalFormat),
      format: finalFormat,
      originalSize: buffer.length,
      size: processedBuffer.length,
      width: finalWidth,
      height: finalHeight,
      compressionRatio: calculateCompressionRatio(buffer.length, processedBuffer.length),
      path: fullPath,
      cdnPath: `${cdnPrefix}/${relativePath.replace(/\\/g, '/')}`,
      variants: [],
      metadata: originalMetadata,
      createdAt: new Date(),
    };

    // 生成多尺寸版本
    if (generateVariants) {
      result.variants = await this.generateVariants(
        processedBuffer,
        uniqueId,
        finalFormat,
        storageDir,
        cdnPrefix
      );
    }

    const duration = Date.now() - startTime;
    this.uploadLogger.info('图片处理完成', {
      id: uniqueId,
      originalSize: buffer.length,
      finalSize: processedBuffer.length,
      compressionRatio: result.compressionRatio.toFixed(2),
      width: finalWidth,
      height: finalHeight,
      variantsCount: result.variants.length,
      durationMs: duration,
    });

    return result;
  }

  /**
   * 生成多尺寸版本
   */
  private async generateVariants(
    sourceBuffer: Buffer,
    id: string,
    format: string,
    storageDir: string,
    cdnPrefix: string
  ): Promise<ProcessedVariant[]> {
    const variants: ProcessedVariant[] = [];

    for (const sizeConfig of this.config.sizes) {
      if (!sizeConfig.enabled || sizeConfig.name === 'original') {
        continue;
      }

      try {
        const variantStartTime = Date.now();
        const targetFormat = sizeConfig.format || format;
        const variantFilename = `${id}_${sizeConfig.name}.${targetFormat}`;
        const relativePath = path.join(sizeConfig.name, variantFilename);
        const fullPath = path.join(storageDir, relativePath);

        // 处理图片
        let sharpInstance = sharp(sourceBuffer);

        // 调整尺寸
        if (sizeConfig.width > 0 || sizeConfig.height > 0) {
          sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
            fit: 'cover',
            position: 'centre',
          });
        }

        // 转换为目标格式 (使用高级WebP参数)
        const variantBuffer = await this.convertFormat(sharpInstance, targetFormat, {
          quality: sizeConfig.quality,
          webpEffort: sizeConfig.webpEffort ?? 4,
          webpLossless: sizeConfig.webpLossless ?? false,
          webpNearLossless: sizeConfig.webpNearLossless ?? false,
        });

        // 保存
        await fs.writeFile(fullPath, variantBuffer);

        // 获取尺寸
        const variantMeta = await sharp(variantBuffer).metadata();

        variants.push({
          name: sizeConfig.name,
          path: fullPath,
          cdnPath: `${cdnPrefix}/${relativePath.replace(/\\/g, '/')}`,
          width: variantMeta.width || sizeConfig.width,
          height: variantMeta.height || sizeConfig.height,
          size: variantBuffer.length,
        });

        this.uploadLogger.debug(`生成 ${sizeConfig.name} 成功`, {
          id,
          name: sizeConfig.name,
          size: variantBuffer.length,
          format: targetFormat,
          durationMs: Date.now() - variantStartTime,
        });
      } catch (error) {
        this.uploadLogger.error(`生成 ${sizeConfig.name} 失败`, error, {
          id,
          name: sizeConfig.name,
        });
      }
    }

    return variants;
  }

  /**
   * 快速压缩单张图片 (不生成多尺寸)
   */
  async compressImage(
    inputBuffer: Buffer,
    options: {
      format?: 'jpeg' | 'webp' | 'png' | 'avif';
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
      stripExif?: boolean;
      webpEffort?: number;
      webpLossless?: boolean;
      webpNearLossless?: boolean;
    } = {}
  ): Promise<Buffer> {
    const {
      format = 'webp',
      quality = 80,
      maxWidth = 1920,
      maxHeight = 1920,
      stripExif = true,
      webpEffort = 4,
      webpLossless = false,
      webpNearLossless = false,
    } = options;

    let sharpInstance = sharp(inputBuffer);

    // 调整尺寸
    sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    // 去除 EXIF
    if (stripExif) {
      sharpInstance = sharpInstance.withMetadata({ orientation: undefined });
    }

    // 转换格式并压缩
    return this.convertFormat(sharpInstance, format, {
      quality,
      webpEffort,
      webpLossless,
      webpNearLossless,
    });
  }

  /**
   * 批量压缩多张图片
   */
  async compressImages(
    images: Array<{ buffer: Buffer; filename: string }>,
    options: {
      format?: 'jpeg' | 'webp' | 'png' | 'avif';
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
    } = {}
  ): Promise<Array<{ filename: string; buffer: Buffer; size: number }>> {
    const results = [];

    for (const { buffer, filename } of images) {
      const compressed = await this.compressImage(buffer, options);
      results.push({
        filename,
        buffer: compressed,
        size: compressed.length,
      });
    }

    return results;
  }

  /**
   * 获取 CDN URL
   */
  getCdnUrl(cdnPath: string): string {
    // 如果已经是完整 URL，直接返回
    if (cdnPath.startsWith('http://') || cdnPath.startsWith('https://')) {
      return cdnPath;
    }
    return `${this.config.cdnPrefix}${cdnPath}`;
  }

  /**
   * 删除图片及其变体
   */
  async deleteImage(image: ProcessedImage): Promise<void> {
    const filesToDelete = [
      image.path,
      ...image.variants.map((v) => v.path),
    ];

    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
        this.uploadLogger.debug('删除文件成功', { path: filePath });
      } catch (error) {
        this.uploadLogger.warn('删除文件失败', {
          path: filePath,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UploadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): UploadConfig {
    return { ...this.config };
  }
}

// ============== 单例导出 ==============

let uploadServiceInstance: UploadService | null = null;

export function getUploadService(config?: Partial<UploadConfig>): UploadService {
  if (!uploadServiceInstance) {
    uploadServiceInstance = new UploadService(config);
  }
  return uploadServiceInstance;
}

export const uploadService = getUploadService();
