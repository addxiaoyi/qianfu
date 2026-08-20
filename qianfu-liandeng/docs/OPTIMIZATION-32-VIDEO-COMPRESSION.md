# 优化项 32: 视频压缩 - FFmpeg 集成

## 概述

在服务端集成 FFmpeg，提供高性能视频压缩、转码、裁剪和元数据提取功能。显著减少视频文件大小，提升传输效率，同时保持良好的视觉质量。

## 功能特性

1. **视频压缩**: 支持 H.264/H.265/VP9 编码器，大幅减小文件体积
2. **格式转换**: 支持 MP4、WebM、AVI、MOV 等主流格式互转
3. **缩放裁剪**: 支持调整分辨率、裁剪特定区域
4. **元数据提取**: 获取视频时长、分辨率、码率、编码器等信息
5. **多质量预设**: 适合不同场景的压缩预设（网络、移动端、存档）
6. **进度回调**: 支持长时间压缩任务的进度通知
7. **水印添加**: 支持添加文字或图片水印

## 技术方案

### 1. 依赖安装

```bash
# 安装 fluent-ffmpeg (FFmpeg Node.js 封装)
npm install fluent-ffmpeg @types/fluent-ffmpeg

# 确保系统已安装 FFmpeg
# macOS: brew install ffmpeg
# Ubuntu/Debian: apt install ffmpeg
# Windows: 下载 ffmpeg.exe 并添加到 PATH
```

### 2. 视频压缩服务

```typescript
// server/services/videoService.ts
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../lib/logger';
import { config as appConfig } from '../config/env';

// ============== 类型定义 ==============

export interface VideoMetadata {
  duration: number;           // 时长(秒)
  width: number;              // 宽度
  height: number;             // 高度
  codec: string;               // 视频编码
  bitrate: number;            // 码率(bps)
  fps: number;                // 帧率
  audioCodec?: string;        // 音频编码
  audioBitrate?: number;      // 音频码率
  size: number;               // 文件大小(bytes)
  format: string;             // 容器格式
}

export interface VideoCompressionOptions {
  /** 输出格式 */
  format?: 'mp4' | 'webm' | 'mov' | 'avi';
  /** 视频编码器: 'libx264' | 'libx265' | 'libvpx-vp9' | 'copy' */
  videoCodec?: string;
  /** 音频编码器: 'aac' | 'libopus' | 'mp3' | 'copy' */
  audioCodec?: string;
  /** 视频码率 (如 '1M', '500k', '2000k') */
  videoBitrate?: string;
  /** 音频码率 (如 '128k', '192k') */
  audioBitrate?: string;
  /** 压缩质量 (1-31, 仅 H.264/H.265, 越小质量越高) */
  crf?: number;
  /** 最大宽度 (保持宽高比) */
  maxWidth?: number;
  /** 最大高度 */
  maxHeight?: number;
  /** 缩放算法: 'bilinear' | 'bicubic' | 'lanczos' */
  scaleAlgorithm?: string;
  /** 起始时间 (秒) */
  startTime?: number;
  /** 持续时间 (秒) */
  duration?: number;
  /** 视频裁剪区域: 'width:height:x:y' */
  crop?: string;
  /** 是否删除原始音频 */
  removeAudio?: boolean;
  /** 旋转角度 (0, 90, 180, 270) */
  rotate?: number;
  /** 帧率 (如 30, 60) */
  fps?: number;
  /** 水印配置 */
  watermark?: {
    text?: string;
    imagePath?: string;
    position?: 'northwest' | 'northeast' | 'southwest' | 'southeast' | 'center';
    opacity?: number;
  };
  /** 输出目录 (默认临时目录) */
  outputDir?: string;
  /** 临时文件名 */
  outputFilename?: string;
}

export interface CompressionPreset {
  name: string;
  description: string;
  options: VideoCompressionOptions;
}

export interface CompressionProgress {
  percent: number;            // 完成百分比 (0-100)
  timemark: string;          // 当前时间戳 (HH:MM:SS.ms)
  speed?: string;            // 处理速度 (如 '1.2x')
  size?: number;             // 当前输出文件大小
  eta?: number;              // 预计剩余时间(秒)
}

export interface CompressionResult {
  success: boolean;
  inputPath?: string;
  outputPath?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  metadata?: VideoMetadata;
  error?: string;
}

// ============== 预设配置 ==============

export const COMPRESSION_PRESETS: Record<string, CompressionPreset> = {
  // 高压缩 - 适合网络传输
  web_optimized: {
    name: 'web_optimized',
    description: '网络优化压缩，最大兼容性',
    options: {
      format: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '1M',
      audioBitrate: '128k',
      crf: 23,
      maxWidth: 1920,
      maxHeight: 1080,
      scaleAlgorithm: 'bicubic',
    },
  },

  // 移动端优化
  mobile_optimized: {
    name: 'mobile_optimized',
    description: '移动端优先，文件小、质量平衡',
    options: {
      format: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '500k',
      audioBitrate: '96k',
      crf: 26,
      maxWidth: 1280,
      maxHeight: 720,
      scaleAlgorithm: 'bilinear',
    },
  },

  // H.265 高效压缩
  h265_high_efficiency: {
    name: 'h265_high_efficiency',
    description: 'H.265 编码，更高压缩率',
    options: {
      format: 'mp4',
      videoCodec: 'libx265',
      audioCodec: 'aac',
      videoBitrate: '800k',
      audioBitrate: '128k',
      crf: 28,
      maxWidth: 1920,
      maxHeight: 1080,
    },
  },

  // VP9 WebM (无版权)
  vp9_webm: {
    name: 'vp9_webm',
    description: 'VP9 编码 WebM 格式',
    options: {
      format: 'webm',
      videoCodec: 'libvpx-vp9',
      audioCodec: 'libopus',
      videoBitrate: '1M',
      audioBitrate: '128k',
      crf: 31,
      maxWidth: 1920,
      maxHeight: 1080,
    },
  },

  // 高质量存档
  archive_high_quality: {
    name: 'archive_high_quality',
    description: '高质量存档，保持原始分辨率',
    options: {
      format: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 18,
      audioBitrate: '256k',
      scaleAlgorithm: 'lanczos',
    },
  },

  // 快速预览 (仅视频无音频)
  preview: {
    name: 'preview',
    description: '快速预览版，无音频，文件最小',
    options: {
      format: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '300k',
      crf: 28,
      maxWidth: 640,
      maxHeight: 480,
      removeAudio: true,
    },
  },
};

// ============== 视频压缩服务 ==============

export class VideoService {
  private videoLogger: ReturnType<typeof logger.category>;
  private tempDir: string;
  private ffmpegPath?: string;
  private ffprobePath?: string;

  constructor(options?: {
    ffmpegPath?: string;
    ffprobePath?: string;
    tempDir?: string;
  }) {
    this.videoLogger = logger.category('video');
    this.tempDir = options?.tempDir || path.join(process.cwd(), 'temp', 'videos');
    this.ffmpegPath = options?.ffmpegPath;
    this.ffprobePath = options?.ffprobePath;

    // 确保临时目录存在
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }

    // 配置 FFmpeg 路径 (如果需要)
    if (this.ffmpegPath) {
      ffmpeg.setFfmpegPath(this.ffmpegPath);
    }
    if (this.ffprobePath) {
      ffmpeg.setFfprobePath(this.ffprobePath);
    }

    this.videoLogger.info('视频服务初始化', { tempDir: this.tempDir });
  }

  /**
   * 获取视频元数据
   */
  getMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          this.videoLogger.error('获取视频元数据失败', err);
          return reject(new Error(`FFprobe 错误: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        // 解析帧率
        let fps = 0;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/');
          fps = den ? parseInt(num) / parseInt(den) : parseInt(num);
        }

        // 获取文件大小
        let fileSize = 0;
        try {
          const stats = fs.statSync(inputPath);
          fileSize = stats.size;
        } catch { /* ignore */ }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(String(metadata.format.bit_rate)) || 0,
          fps: Math.round(fps * 100) / 100,
          audioCodec: audioStream?.codec_name,
          audioBitrate: audioStream?.bit_rate ? parseInt(String(audioStream.bit_rate)) : undefined,
          size: fileSize,
          format: metadata.format.format_name || 'unknown',
        });
      });
    });
  }

  /**
   * 获取支持的编码器列表
   */
  getSupportedCodecs(): Promise<{ video: string[]; audio: string[] }> {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) {
          return reject(err);
        }

        const videoCodecs: string[] = [];
        const audioCodecs: string[] = [];

        Object.entries(codecs).forEach(([name, codec]: [string, any]) => {
          if (codec.encoding) {
            if (codec.type === 'video') {
              videoCodecs.push(name);
            } else if (codec.type === 'audio') {
              audioCodecs.push(name);
            }
          }
        });

        resolve({ video: videoCodecs, audio: audioCodecs });
      });
    });
  }

  /**
   * 压缩视频
   */
  async compressVideo(
    inputBuffer: Buffer,
    options: VideoCompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const inputPath = path.join(this.tempDir, `input_${Date.now()}.tmp`);
    const outputFilename = options.outputFilename || `output_${Date.now()}.mp4`;
    const outputPath = path.join(options.outputDir || this.tempDir, outputFilename);

    try {
      // 保存输入文件
      await fs.writeFile(inputPath, inputBuffer);

      // 获取原始元数据
      const originalMetadata = await this.getMetadata(inputPath);
      this.videoLogger.info('开始压缩视频', {
        originalSize: originalMetadata.size,
        originalCodec: originalMetadata.codec,
        duration: originalMetadata.duration,
      });

      // 构建 FFmpeg 命令
      const command = ffmpeg(inputPath);

      // 视频编码器
      if (options.videoCodec && options.videoCodec !== 'copy') {
        command.videoCodec(options.videoCodec);
      } else if (options.videoCodec === 'copy') {
        command.videoCodec('copy');
      }

      // 音频编码器
      if (options.removeAudio) {
        command.noAudio();
      } else if (options.audioCodec) {
        command.audioCodec(options.audioCodec === 'copy' ? 'copy' : options.audioCodec);
      }

      // 码率控制
      if (options.videoBitrate && options.videoCodec !== 'copy') {
        command.videoBitrate(options.videoBitrate);
      }
      if (options.audioBitrate) {
        command.audioBitrate(options.audioBitrate);
      }

      // CRF (质量控制)
      if (options.crf !== undefined && options.videoCodec && options.videoCodec !== 'copy') {
        command.outputOptions([`-crf ${options.crf}`]);
      }

      // 缩放
      if (options.maxWidth || options.maxHeight) {
        const scaleStr = `scale=${options.maxWidth || -1}:${options.maxHeight || -1}`;
        const algo = options.scaleAlgorithm || 'bicubic';
        command.videoFilters(`${scaleStr}:flags=${algo}`);
      }

      // 裁剪
      if (options.crop) {
        command.videoFilters(`crop=${options.crop}`);
      }

      // 旋转
      if (options.rotate) {
        command.videoFilters(`rotate=${options.rotate * Math.PI / 180}`);
      }

      // 帧率
      if (options.fps) {
        command.outputOptions([`-r ${options.fps}`]);
      }

      // 时间范围
      if (options.startTime !== undefined) {
        command.seekInput(options.startTime);
      }
      if (options.duration !== undefined) {
        command.duration(options.duration);
      }

      // 水印
      if (options.watermark) {
        const filter = this.buildWatermarkFilter(options.watermark);
        if (filter) {
          command.videoFilters(filter);
        }
      }

      // 设置输出格式
      if (options.format) {
        command.toFormat(options.format);
      }

      // 进度回调
      if (onProgress) {
        command.on('progress', (progress) => {
          onProgress({
            percent: progress.percent || 0,
            timemark: progress.timemark || '00:00:00',
            speed: progress.currentFps ? `${progress.currentFps}fps` : undefined,
            eta: progress.targetSize ? undefined : undefined,
          });
        });
      }

      // 执行压缩
      await new Promise<void>((resolve, reject) => {
        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      // 读取压缩后的文件
      const outputBuffer = await fs.readFile(outputPath);
      const compressedMetadata = await this.getMetadata(outputPath);

      const result: CompressionResult = {
        success: true,
        inputPath,
        outputPath,
        originalSize: originalMetadata.size,
        compressedSize: outputBuffer.length,
        compressionRatio: outputBuffer.length / originalMetadata.size,
        metadata: compressedMetadata,
      };

      const duration = Date.now() - startTime;
      this.videoLogger.info('视频压缩完成', {
        originalSize: originalMetadata.size,
        compressedSize: outputBuffer.length,
        compressionRatio: result.compressionRatio?.toFixed(2),
        savedPercent: ((1 - result.compressionRatio!) * 100).toFixed(1) + '%',
        durationMs: duration,
      });

      return result;

    } catch (error) {
      this.videoLogger.error('视频压缩失败', error);
      return {
        success: false,
        inputPath,
        outputPath,
        error: (error as Error).message,
      };
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(inputPath);
      } catch { /* ignore */ }
    }
  }

  /**
   * 压缩视频文件 (从磁盘读取)
   */
  async compressVideoFile(
    inputPath: string,
    options: VideoCompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const inputBuffer = await fs.readFile(inputPath);
    const result = await this.compressVideo(inputBuffer, options, onProgress);
    result.inputPath = inputPath;
    return result;
  }

  /**
   * 使用预设压缩
   */
  async compressWithPreset(
    inputBuffer: Buffer,
    presetName: string,
    overrides?: Partial<VideoCompressionOptions>,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const preset = COMPRESSION_PRESETS[presetName];
    if (!preset) {
      return {
        success: false,
        error: `未知预设: ${presetName}`,
      };
    }

    const options = { ...preset.options, ...overrides };
    return this.compressVideo(inputBuffer, options, onProgress);
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    inputPath: string,
    options: {
      time?: number;           // 截取时间点(秒)
      width?: number;
      height?: number;
      outputPath?: string;
      format?: 'jpg' | 'png' | 'webp';
    } = {}
  ): Promise<Buffer> {
    const {
      time = 1,
      width = 320,
      height = 180,
      format = 'jpg',
    } = options;

    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `thumb_${Date.now()}.${format}`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(time)
        .frames(1)
        .size(`${width}x${height}`)
        .toFormat(format)
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            if (!options.outputPath) {
              await fs.unlink(outputPath);
            }
            resolve(buffer);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * 生成 GIF 动图
   */
  async generateGif(
    inputPath: string,
    options: {
      startTime?: number;
      duration?: number;
      width?: number;
      fps?: number;
      outputPath?: string;
    } = {}
  ): Promise<Buffer> {
    const {
      startTime = 0,
      duration = 5,
      width = 320,
      fps = 10,
    } = options;

    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `gif_${Date.now()}.gif`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .outputOptions([
          `-vf scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer`,
          `-r ${fps}`,
        ])
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            if (!options.outputPath) {
              await fs.unlink(outputPath);
            }
            resolve(buffer);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * 合并视频片段
   */
  async mergeVideos(
    inputPaths: string[],
    options: {
      outputPath?: string;
      format?: string;
    } = {}
  ): Promise<Buffer> {
    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `merged_${Date.now()}.mp4`
    );

    // 创建临时文件列表
    const listPath = path.join(this.tempDir, `list_${Date.now()}.txt`);
    const listContent = inputPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(listPath, listContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            await fs.unlink(listPath);
            if (!options.outputPath) {
              await fs.unlink(outputPath);
            }
            resolve(buffer);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * 构建水印过滤器
   */
  private buildWatermarkFilter(watermark: NonNullable<VideoCompressionOptions['watermark']>): string | null {
    const positionMap: Record<string, string> = {
      northwest: '10:10',
      northeast: 'W-w-10:10',
      southwest: '10:H-h-10',
      southeast: 'W-w-10:H-h-10',
      center: '(W-w)/2:(H-h)/2',
    };

    if (watermark.text) {
      const pos = positionMap[watermark.position || 'southeast'];
      const opacity = watermark.opacity ?? 0.8;
      return `drawtext=text='${watermark.text}':fontsize=24:fontcolor=white@{opacity}:x=${pos}`;
    }

    if (watermark.imagePath) {
      const pos = positionMap[watermark.position || 'southeast'];
      return `overlay=${pos}`;
    }

    return null;
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24小时

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          this.videoLogger.debug('清理临时文件', { file });
        }
      }
    } catch (error) {
      this.videoLogger.error('清理临时文件失败', error);
    }
  }
}

// ============== 单例导出 ==============

let videoServiceInstance: VideoService | null = null;

export function getVideoService(config?: ConstructorParameters<typeof VideoService>[0]): VideoService {
  if (!videoServiceInstance) {
    videoServiceInstance = new VideoService(config);
  }
  return videoServiceInstance;
}

export const videoService = getVideoService();

export default videoService;
```

### 3. 视频上传路由

```typescript
// server/routes/video.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { videoService, COMPRESSION_PRESETS } from '../services/videoService';
import { logger } from '../lib/logger';

const router = Router();
const videoLogger = logger.category('video-route');

// ============== Multer 配置 ==============

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB 最大
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/mpeg',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的视频格式: ${file.mimetype}`));
    }
  },
});

// ============== 类型定义 ==============

interface CompressionRequest {
  format?: 'mp4' | 'webm' | 'mov' | 'avi';
  preset?: string;
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  maxWidth?: number;
  maxHeight?: number;
  startTime?: number;
  duration?: number;
  removeAudio?: boolean;
}

// ============== 路由处理 ==============

/**
 * POST /api/video/metadata
 * 获取视频元数据
 */
router.post('/metadata', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传视频文件' });
    }

    const tempPath = `/tmp/metadata_${Date.now()}.mp4`;
    require('fs').writeFileSync(tempPath, req.file.buffer);

    try {
      const metadata = await videoService.getMetadata(tempPath);
      require('fs').unlinkSync(tempPath);

      res.json({
        success: true,
        metadata: {
          duration: metadata.duration,
          durationFormatted: formatDuration(metadata.duration),
          width: metadata.width,
          height: metadata.height,
          resolution: `${metadata.width}x${metadata.height}`,
          codec: metadata.codec,
          bitrate: formatBitrate(metadata.bitrate),
          fps: metadata.fps,
          audioCodec: metadata.audioCodec,
          audioBitrate: metadata.audioBitrate ? formatBitrate(metadata.audioBitrate) : null,
          size: metadata.size,
          sizeFormatted: formatFileSize(metadata.size),
          format: metadata.format,
        },
      });
    } catch (err) {
      require('fs').unlinkSync(tempPath);
      throw err;
    }
  } catch (error) {
    videoLogger.error('获取元数据失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/video/compress
 * 压缩视频
 */
router.post('/compress', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传视频文件' });
    }

    const options: CompressionRequest = req.body;
    const videoOptions = buildCompressionOptions(options);

    videoLogger.info('开始压缩视频', {
      originalSize: req.file.size,
      options: videoOptions,
    });

    const result = await videoService.compressVideo(req.file.buffer, videoOptions);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // 发送压缩后的视频
    const outputFilename = `compressed_${Date.now()}.${options.format || 'mp4'}`;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="${outputFilename}"`);
    res.setHeader('X-Original-Size', String(result.originalSize));
    res.setHeader('X-Compressed-Size', String(result.compressedSize));
    res.setHeader('X-Compression-Ratio', result.compressionRatio?.toFixed(2));

    // 读取并发送压缩后的文件
    if (result.outputPath) {
      const outputBuffer = require('fs').readFileSync(result.outputPath);
      require('fs').unlinkSync(result.outputPath); // 清理临时文件

      res.json({
        success: true,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio?.toFixed(2),
        savedPercent: ((1 - result.compressionRatio!) * 100).toFixed(1),
        metadata: result.metadata,
        video: outputBuffer.toString('base64'),
      });
    } else {
      res.status(500).json({
        success: false,
        error: '压缩失败：未生成输出文件',
      });
    }
  } catch (error) {
    videoLogger.error('视频压缩失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/video/compress/preset
 * 使用预设压缩视频
 */
router.post('/compress/preset', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传视频文件' });
    }

    const { preset, overrides } = req.body;

    if (!preset || !COMPRESSION_PRESETS[preset]) {
      return res.status(400).json({
        success: false,
        error: `未知预设。可用预设: ${Object.keys(COMPRESSION_PRESETS).join(', ')}`,
      });
    }

    videoLogger.info('使用预设压缩视频', {
      preset,
      originalSize: req.file.size,
    });

    const result = await videoService.compressWithPreset(
      req.file.buffer,
      preset,
      overrides
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      preset,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio?.toFixed(2),
      savedPercent: ((1 - result.compressionRatio!) * 100).toFixed(1),
      metadata: result.metadata,
    });
  } catch (error) {
    videoLogger.error('预设压缩失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/video/thumbnail
 * 生成缩略图
 */
router.post('/thumbnail', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传视频文件' });
    }

    const { time, width, height, format } = req.body;
    const tempPath = `/tmp/thumb_input_${Date.now()}.mp4`;
    require('fs').writeFileSync(tempPath, req.file.buffer);

    try {
      const thumbnail = await videoService.generateThumbnail(tempPath, {
        time: parseFloat(time) || 1,
        width: parseInt(width) || 320,
        height: parseInt(height) || 180,
        format: format || 'jpg',
      });

      require('fs').unlinkSync(tempPath);

      res.setHeader('Content-Type', `image/${format || 'jpeg'}`);
      res.send(thumbnail);
    } catch (err) {
      require('fs').unlinkSync(tempPath);
      throw err;
    }
  } catch (error) {
    videoLogger.error('生成缩略图失败', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/video/presets
 * 获取可用预设列表
 */
router.get('/presets', (req: Request, res: Response) => {
  const presets = Object.entries(COMPRESSION_PRESETS).map(([key, preset]) => ({
    id: key,
    name: preset.name,
    description: preset.description,
    options: preset.options,
  }));

  res.json({
    success: true,
    presets,
  });
});

// ============== 辅助函数 ==============

function buildCompressionOptions(options: CompressionRequest) {
  return {
    format: options.format as any,
    videoCodec: options.videoCodec,
    audioCodec: options.audioCodec,
    videoBitrate: options.videoBitrate,
    audioBitrate: options.audioBitrate,
    crf: options.crf ? parseInt(options.crf) : undefined,
    maxWidth: options.maxWidth ? parseInt(options.maxWidth) : undefined,
    maxHeight: options.maxHeight ? parseInt(options.maxHeight) : undefined,
    startTime: options.startTime ? parseFloat(options.startTime) : undefined,
    duration: options.duration ? parseFloat(options.duration) : undefined,
    removeAudio: options.removeAudio === 'true' || options.removeAudio === true,
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  }
  return `${(bps / 1000).toFixed(0)} kbps`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export default router;
```

### 4. 路由注册

```typescript
// server/routes/index.ts
import videoRouter from './video';

// 注册视频路由
app.use(`${apiPrefix}/video`, videoRouter);
```

## 文件结构

```
server/
├── services/
│   ├── uploadService.ts       # 图片压缩服务 (已有)
│   └── videoService.ts        # 视频压缩服务 (新增)
├── routes/
│   ├── upload.ts              # 图片上传路由 (已有)
│   └── video.ts               # 视频压缩路由 (新增)
└── config/
    └── env.ts                 # 配置 (需添加视频配置)
```

## 环境变量配置

```env
# 视频配置
MAX_VIDEO_SIZE=500              # 最大视频大小 (MB)
VIDEO_TEMP_DIR=./temp/videos    # 临时目录
FFMPEG_PATH=                    # FFmpeg 路径 (可选)
FFPROBE_PATH=                   # FFprobe 路径 (可选)

# 默认压缩设置
DEFAULT_VIDEO_CRF=23            # 默认质量 (1-51)
DEFAULT_VIDEO_FORMAT=mp4       # 默认格式
DEFAULT_VIDEO_MAX_WIDTH=1920    # 默认最大宽度
DEFAULT_VIDEO_MAX_HEIGHT=1080   # 默认最大高度
```

## API 参考

### 1. 获取视频元数据

```
POST /api/video/metadata
Content-Type: multipart/form-data

Body:
  - video: <video file>

Response:
{
  "success": true,
  "metadata": {
    "duration": 120.5,
    "durationFormatted": "00:02:00",
    "width": 1920,
    "height": 1080,
    "resolution": "1920x1080",
    "codec": "h264",
    "bitrate": "5.00 Mbps",
    "fps": 30,
    "audioCodec": "aac",
    "audioBitrate": "192 kbps",
    "size": "150 MB",
    "sizeFormatted": "150.00 MB",
    "format": "mp4"
  }
}
```

### 2. 压缩视频

```
POST /api/video/compress
Content-Type: multipart/form-data

Body:
  - video: <video file>
  - format: mp4 (可选)
  - preset: web_optimized (可选, 覆盖其他选项)
  - videoCodec: libx264 (可选)
  - audioCodec: aac (可选)
  - videoBitrate: 1M (可选)
  - audioBitrate: 128k (可选)
  - crf: 23 (可选, 1-51)
  - maxWidth: 1920 (可选)
  - maxHeight: 1080 (可选)
  - removeAudio: false (可选)

Response:
{
  "success": true,
  "originalSize": 157286400,
  "compressedSize": 20971520,
  "compressionRatio": "0.13",
  "savedPercent": "86.7",
  "metadata": { ... }
}
```

### 3. 使用预设压缩

```
POST /api/video/compress/preset
Content-Type: multipart/form-data

Body:
  - video: <video file>
  - preset: web_optimized | mobile_optimized | h265_high_efficiency | vp9_webm | archive_high_quality | preview
  - overrides: {} (可选, 覆盖预设选项)

Response:
{
  "success": true,
  "preset": "web_optimized",
  "originalSize": 157286400,
  "compressedSize": 10485760,
  "compressionRatio": "0.07",
  "savedPercent": "93.3"
}
```

### 4. 生成缩略图

```
POST /api/video/thumbnail
Content-Type: multipart/form-data

Body:
  - video: <video file>
  - time: 1 (秒, 可选, 默认1)
  - width: 320 (可选)
  - height: 180 (可选)
  - format: jpg | png | webm (可选, 默认jpg)

Response: <binary image data>
```

### 5. 获取预设列表

```
GET /api/video/presets

Response:
{
  "success": true,
  "presets": [
    {
      "id": "web_optimized",
      "name": "web_optimized",
      "description": "网络优化压缩，最大兼容性",
      "options": { ... }
    },
    ...
  ]
}
```

## 性能优化建议

1. **异步处理**: 对于大文件，使用消息队列异步处理，避免阻塞主线程
2. **临时文件管理**: 定期清理 temp 目录中的旧文件
3. **流式处理**: 使用 `stream.pipe()` 替代全量 Buffer 处理，减少内存占用
4. **并发控制**: 限制同时压缩的任务数，避免资源耗尽
5. **缓存元数据**: 相同视频的元数据可缓存复用

## 错误处理

| 错误类型 | 错误码 | 说明 |
|---------|-------|------|
| FORMAT_NOT_SUPPORTED | 400 | 不支持的视频格式 |
| FILE_TOO_LARGE | 400 | 视频文件超过限制 |
| FFPROBE_ERROR | 500 | 无法读取视频元数据 |
| FFMPEG_ERROR | 500 | FFmpeg 压缩失败 |
| TIMEOUT | 504 | 压缩超时 |

## 安全注意事项

1. **文件验证**: 严格验证上传的视频格式，避免恶意文件
2. **路径遍历**: 禁止用户指定输出路径，防止路径遍历攻击
3. **资源限制**: 设置最大文件大小和压缩任务超时
4. **临时文件清理**: 确保临时文件及时清理，避免磁盘空间耗尽
5. **权限控制**: 限制可访问视频压缩 API 的用户角色
