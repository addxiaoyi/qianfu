/**
 * 视频压缩服务
 *
 * 功能:
 * - FFmpeg 集成视频压缩
 * - 多种编码器支持 (H.264/H.265/VP9)
 * - 格式转换 (MP4/WebM/MOV)
 * - 元数据提取
 * - 缩略图生成
 * - GIF 动图生成
 * - 多质量预设
 * - 进度回调
 *
 * 依赖:
 * - fluent-ffmpeg: FFmpeg Node.js 封装
 * - ffmpeg: 系统已安装 FFmpeg
 *
 * 安装:
 * ```bash
 * npm install fluent-ffmpeg @types/fluent-ffmpeg
 *
 * # 确保系统已安装 FFmpeg
 * # macOS: brew install ffmpeg
 * # Ubuntu/Debian: apt install ffmpeg
 * # Windows: 下载 ffmpeg.exe 并添加到 PATH
 * ```
 *
 * 使用示例:
 * ```typescript
 * import { videoService, COMPRESSION_PRESETS } from './services/videoService';
 *
 * // 获取视频元数据
 * const metadata = await videoService.getMetadata('input.mp4');
 *
 * // 压缩视频
 * const result = await videoService.compressVideo(buffer, {
 *   format: 'mp4',
 *   videoCodec: 'libx264',
 *   crf: 23,
 *   maxWidth: 1920,
 * });
 *
 * // 使用预设压缩
 * const result = await videoService.compressWithPreset(buffer, 'web_optimized');
 *
 * // 生成缩略图
 * const thumbnail = await videoService.generateThumbnail('input.mp4', {
 *   time: 5,
 *   width: 320,
 * });
 * ```
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../lib/logger';
import { config as appConfig } from '../config/env';

// ============== 类型定义 ==============

export interface VideoMetadata {
  /** 时长 (秒) */
  duration: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 视频编码 */
  codec: string;
  /** 码率 (bps) */
  bitrate: number;
  /** 帧率 */
  fps: number;
  /** 音频编码 */
  audioCodec?: string;
  /** 音频码率 (bps) */
  audioBitrate?: number;
  /** 文件大小 (bytes) */
  size: number;
  /** 容器格式 */
  format: string;
}

export interface VideoCompressionOptions {
  /** 输出格式 */
  format?: 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv';
  /** 视频编码器 */
  videoCodec?: 'libx264' | 'libx265' | 'libvpx-vp9' | 'libvpx' | 'copy' | string;
  /** 音频编码器 */
  audioCodec?: 'aac' | 'libopus' | 'mp3' | 'libvorbis' | 'copy' | string;
  /** 视频码率 (如 '1M', '500k', '2000k') */
  videoBitrate?: string;
  /** 音频码率 (如 '128k', '192k') */
  audioBitrate?: string;
  /** 压缩质量 (1-51, 越小质量越高) */
  crf?: number;
  /** 最大宽度 (保持宽高比) */
  maxWidth?: number;
  /** 最大高度 */
  maxHeight?: number;
  /** 缩放算法 */
  scaleAlgorithm?: 'bilinear' | 'bicubic' | 'lanczos' | string;
  /** 起始时间 (秒) */
  startTime?: number;
  /** 持续时间 (秒) */
  duration?: number;
  /** 视频裁剪区域 'width:height:x:y' */
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
  /** 输出目录 */
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
  /** 完成百分比 (0-100) */
  percent: number;
  /** 当前时间戳 (HH:MM:SS.ms) */
  timemark: string;
  /** 处理速度 (如 '1.2x') */
  speed?: string;
  /** 当前输出文件大小 (bytes) */
  size?: number;
  /** 预计剩余时间 (秒) */
  eta?: number;
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

export interface ThumbnailOptions {
  /** 截取时间点 (秒) */
  time?: number;
  /** 输出宽度 */
  width?: number;
  /** 输出高度 */
  height?: number;
  /** 输出路径 */
  outputPath?: string;
  /** 输出格式 */
  format?: 'jpg' | 'png' | 'webp';
}

export interface GifOptions {
  /** 起始时间 (秒) */
  startTime?: number;
  /** 持续时间 (秒) */
  duration?: number;
  /** 输出宽度 */
  width?: number;
  /** 输出帧率 */
  fps?: number;
  /** 输出路径 */
  outputPath?: string;
}

// ============== 预设配置 ==============

export const COMPRESSION_PRESETS: Record<string, CompressionPreset> = {
  /** 网络优化压缩，最大兼容性 */
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

  /** 移动端优先，文件小 */
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

  /** H.265 高效压缩 */
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

  /** VP9 WebM 无版权 */
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

  /** 高质量存档 */
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

  /** 快速预览，无音频 */
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

// ============== 工具函数 ==============

const videoLogger = logger.category('video');

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 格式化码率
 */
function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  }
  return `${(bps / 1000).toFixed(0)} kbps`;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

// ============== 视频服务 ==============

export class VideoService {
  private serviceLogger: ReturnType<typeof logger.category>;
  private tempDir: string;
  private ffmpegPath?: string;
  private ffprobePath?: string;

  constructor(options?: {
    ffmpegPath?: string;
    ffprobePath?: string;
    tempDir?: string;
  }) {
    this.serviceLogger = logger.category('video');

    // 优先使用配置，否则使用选项，否则使用默认值
    const videoConfig = appConfig.video || {};
    this.tempDir = options?.tempDir || videoConfig.tempDir || path.join(process.cwd(), 'temp', 'videos');
    this.ffmpegPath = options?.ffmpegPath || videoConfig.ffmpegPath;
    this.ffprobePath = options?.ffprobePath || videoConfig.ffprobePath;

    // 确保临时目录存在
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }

    // 配置 FFmpeg 路径
    if (this.ffmpegPath) {
      ffmpeg.setFfmpegPath(this.ffmpegPath);
      this.serviceLogger.debug('FFmpeg 路径已设置', { path: this.ffmpegPath });
    }
    if (this.ffprobePath) {
      ffmpeg.setFfprobePath(this.ffprobePath);
      this.serviceLogger.debug('FFprobe 路径已设置', { path: this.ffprobePath });
    }

    this.serviceLogger.info('视频服务初始化', { tempDir: this.tempDir });
  }

  /**
   * 检查 FFmpeg 是否可用
   */
  checkFfmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          this.serviceLogger.error('FFmpeg 不可用', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 获取支持的编码器
   */
  getSupportedCodecs(): Promise<{ video: string[]; audio: string[] }> {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) {
          this.serviceLogger.error('获取编码器失败', err);
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
   * 获取视频元数据
   */
  getMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          this.serviceLogger.error('获取视频元数据失败', err);
          return reject(new Error(`FFprobe 错误: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        // 解析帧率
        let fps = 0;
        if (videoStream?.r_frame_rate) {
          const [num, den] = String(videoStream.r_frame_rate).split('/');
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
   * 压缩视频 (从 Buffer)
   */
  async compressVideo(
    inputBuffer: Buffer,
    options: VideoCompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const inputFilename = `input_${Date.now()}.tmp`;
    const inputPath = path.join(this.tempDir, inputFilename);
    const outputFilename = options.outputFilename || `output_${Date.now()}.mp4`;
    const outputPath = path.join(options.outputDir || this.tempDir, outputFilename);

    try {
      // 保存输入文件
      await fs.writeFile(inputPath, inputBuffer);

      // 获取原始元数据
      const originalMetadata = await this.getMetadata(inputPath);
      this.serviceLogger.info('开始压缩视频', {
        originalSize: originalMetadata.size,
        originalCodec: originalMetadata.codec,
        duration: originalMetadata.duration,
      });

      // 执行压缩
      const result = await this.executeCompression(
        inputPath,
        outputPath,
        originalMetadata,
        options,
        onProgress
      );

      const duration = Date.now() - startTime;

      if (result.success) {
        // 读取压缩后的文件
        const outputBuffer = await fs.readFile(outputPath);
        const compressedMetadata = await this.getMetadata(outputPath);

        const compressionResult: CompressionResult = {
          success: true,
          inputPath,
          outputPath,
          originalSize: originalMetadata.size,
          compressedSize: outputBuffer.length,
          compressionRatio: outputBuffer.length / originalMetadata.size,
          metadata: compressedMetadata,
        };

        this.serviceLogger.info('视频压缩完成', {
          originalSize: originalMetadata.size,
          compressedSize: outputBuffer.length,
          compressionRatio: compressionResult.compressionRatio?.toFixed(2),
          savedPercent: ((1 - compressionResult.compressionRatio!) * 100).toFixed(1) + '%',
          durationMs: duration,
        });

        return compressionResult;
      }

      return result;

    } catch (error) {
      this.serviceLogger.error('视频压缩失败', error);
      return {
        success: false,
        inputPath,
        outputPath,
        error: (error as Error).message,
      };
    } finally {
      // 清理输入临时文件
      try {
        await fs.unlink(inputPath);
      } catch { /* ignore */ }
    }
  }

  /**
   * 执行 FFmpeg 压缩
   */
  private executeCompression(
    inputPath: string,
    outputPath: string,
    originalMetadata: VideoMetadata,
    options: VideoCompressionOptions,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    return new Promise((resolve) => {
      const command = ffmpeg(inputPath);

      // 视频编码器
      if (options.videoCodec && options.videoCodec !== 'copy') {
        command.videoCodec(options.videoCodec);
      } else if (options.videoCodec === 'copy') {
        command.videoCodec('copy');
      }

      // 音频处理
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

      // CRF 质量控制
      if (options.crf !== undefined && options.videoCodec && options.videoCodec !== 'copy') {
        command.outputOptions([`-crf ${options.crf}`]);
      }

      // 缩放
      if (options.maxWidth || options.maxHeight) {
        const w = options.maxWidth || -1;
        const h = options.maxHeight || -1;
        const algo = options.scaleAlgorithm || 'bicubic';
        command.videoFilters(`scale=${w}:${h}:flags=${algo}`);
      }

      // 裁剪
      if (options.crop) {
        command.videoFilters(`crop=${options.crop}`);
      }

      // 旋转
      if (options.rotate) {
        const radians = options.rotate * Math.PI / 180;
        command.videoFilters(`rotate=${radians}`);
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
      const watermarkFilter = this.buildWatermarkFilter(options.watermark);
      if (watermarkFilter) {
        command.videoFilters(watermarkFilter);
      }

      // 输出格式
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
          });
        });
      }

      // 执行
      command
        .on('end', () => resolve({ success: true }))
        .on('error', (err) => {
          this.serviceLogger.error('FFmpeg 执行错误', err);
          resolve({ success: false, error: err.message });
        })
        .save(outputPath);
    });
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
    overrides?: Partial<VideoCompressionOptions>
  ): Promise<CompressionResult> {
    const preset = COMPRESSION_PRESETS[presetName];
    if (!preset) {
      return {
        success: false,
        error: `未知预设: ${presetName}。可用预设: ${Object.keys(COMPRESSION_PRESETS).join(', ')}`,
      };
    }

    const options = { ...preset.options, ...overrides };
    return this.compressVideo(inputBuffer, options);
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    inputPath: string,
    options: ThumbnailOptions = {}
  ): Promise<Buffer> {
    const {
      time = 1,
      width = 320,
      height,
      format = 'jpg',
    } = options;

    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `thumb_${Date.now()}.${format}`
    );

    const sizeStr = height ? `${width}x${height}` : `${width}x?`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(time)
        .frames(1)
        .size(sizeStr)
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
        .on('error', (err) => {
          this.serviceLogger.error('生成缩略图失败', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * 生成 GIF 动图
   */
  async generateGif(
    inputPath: string,
    options: GifOptions = {}
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
        .on('error', (err) => {
          this.serviceLogger.error('生成 GIF 失败', err);
          reject(err);
        })
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
    const listContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
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
        .on('error', (err) => {
          this.serviceLogger.error('合并视频失败', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * 提取音频
   */
  async extractAudio(
    inputPath: string,
    options: {
      format?: 'mp3' | 'aac' | 'wav' | 'ogg';
      bitrate?: string;
      outputPath?: string;
    } = {}
  ): Promise<Buffer> {
    const {
      format = 'mp3',
      bitrate = '192k',
    } = options;

    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `audio_${Date.now()}.${format}`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec(format === 'mp3' ? 'libmp3lame' : format === 'ogg' ? 'libvorbis' : 'aac')
        .audioBitrate(bitrate)
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
        .on('error', (err) => {
          this.serviceLogger.error('提取音频失败', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * 添加音频轨道
   */
  async addAudioTrack(
    videoPath: string,
    audioPath: string,
    options: {
      audioCodec?: string;
      audioBitrate?: string;
      outputPath?: string;
    } = {}
  ): Promise<Buffer> {
    const outputPath = options.outputPath || path.join(
      this.tempDir,
      `merged_${Date.now()}.mp4`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .input(audioPath)
        .audioCodec(options.audioCodec || 'aac')
        .audioBitrate(options.audioBitrate || '128k')
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
        .on('error', (err) => {
          this.serviceLogger.error('添加音轨失败', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * 构建水印过滤器
   */
  private buildWatermarkFilter(watermark: VideoCompressionOptions['watermark']): string | null {
    if (!watermark) return null;

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
      const escapedText = watermark.text.replace(/'/g, "'\\''");
      return `drawtext=text='${escapedText}':fontsize=24:fontcolor=white@${opacity}:x=${pos}`;
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
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch { /* ignore */ }
      }

      if (cleaned > 0) {
        this.serviceLogger.info('清理临时文件', { cleaned, maxAgeHours });
      }
      return cleaned;
    } catch (error) {
      this.serviceLogger.error('清理临时文件失败', error);
      return 0;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    available: boolean;
    tempDir: string;
    ffmpegPath?: string;
    ffprobePath?: string;
    version?: string;
  } {
    return {
      available: true, // 实际状态需要异步检查
      tempDir: this.tempDir,
      ffmpegPath: this.ffmpegPath,
      ffprobePath: this.ffprobePath,
    };
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

// 辅助函数导出
export const videoUtils = {
  formatDuration,
  formatBitrate,
  formatFileSize,
};

export default videoService;
