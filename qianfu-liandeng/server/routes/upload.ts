/**
 * 图片上传路由
 *
 * 提供 RESTful API 进行图片上传、压缩和管理
 *
 * 端点:
 * - POST   /api/upload          - 上传单张图片
 * - POST   /api/upload/batch    - 批量上传图片
 * - GET    /api/upload/:id      - 获取图片信息
 * - DELETE /api/upload/:id      - 删除图片
 * - POST   /api/upload/compress - 仅压缩图片 (不保存)
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getUploadService, ProcessedImage } from '../services/uploadService';
import { logger } from '../lib/logger';
import { requireAuth } from '../middleware/auth';

const router = Router();
const uploadLogger = logger.category('upload-route');

// ============== Multer 配置 ==============

const safeOriginalName = (value: string | undefined) => {
  const normalized = String(value || 'upload').replace(/\\/g, '/').split('/').pop() || 'upload';
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'upload';
};

// Keep multipart buffers out of the Node heap; image processing reads one file at a time below.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => cb(null, `qianfu-upload-${randomUUID()}-${safeOriginalName(file.originalname)}`),
});

const cleanupTempFiles = async (files: Express.Multer.File[] = []) => {
  await Promise.all(files.filter(file => file.path).map(async file => {
    try {
      await fs.rm(path.resolve(file.path), { force: true });
    } catch (error) {
      uploadLogger.warn('临时上传文件清理失败', {
        path: file.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }));
};

// 文件过滤器
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的图片格式: ${file.mimetype}`));
  }
};

// Multer 中间件
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // 最多 10 个文件
  },
});

// ============== 类型定义 ==============

interface UploadRequest extends Request {
  images?: ProcessedImage[];
}

// ============== 辅助函数 ==============

/**
 * 处理 Multer 错误
 */
function handleMulterError(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  void cleanupTempFiles([
    ...(req.file ? [req.file] : []),
    ...((req.files as Express.Multer.File[] | undefined) || []),
  ]);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小超过限制 (最大 10MB)',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '文件数量超过限制 (最多 10 个)',
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  if (err.message.includes('不支持的图片格式')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  next(err);
}

/**
 * 统一响应格式
 */
function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message: message || '操作成功',
    data,
  };
}

function errorResponse(error: string | Error, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: typeof error === 'string' ? error : error.message,
  });
}

// ============== 路由处理 ==============

/**
 * POST /api/upload
 * 上传单张图片
 */
router.post(
  '/',
  requireAuth,
  upload.single('image'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请选择要上传的图片',
        });
      }

      const uploadService = getUploadService();
      const fileBuffer = await fs.readFile(req.file.path);
      const result = await uploadService.processImage(fileBuffer, {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        generateVariants: true,
        quality: 80,
      });

      uploadLogger.info('图片上传成功', {
        id: result.id,
        originalSize: result.originalSize,
        finalSize: result.size,
        compressionRatio: result.compressionRatio.toFixed(2),
      });

      return res.status(201).json(
        successResponse({
          id: result.id,
          filename: result.filename,
          originalName: result.originalName,
          url: result.cdnPath,
          urls: {
            original: result.cdnPath,
            thumbnail: result.variants.find((v) => v.name === 'thumbnail')?.cdnPath,
            medium: result.variants.find((v) => v.name === 'medium')?.cdnPath,
            large: result.variants.find((v) => v.name === 'large')?.cdnPath,
          },
          size: result.size,
          originalSize: result.originalSize,
          compressionRatio: result.compressionRatio,
          width: result.width,
          height: result.height,
          format: result.format,
          createdAt: result.createdAt,
        })
      );
    } catch (error) {
      next(error);
    } finally {
      await cleanupTempFiles(req.file ? [req.file] : []);
    }
  }
);

/**
 * POST /api/upload/batch
 * 批量上传图片
 */
router.post(
  '/batch',
  requireAuth,
  upload.array('images', 10),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    try {
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请选择要上传的图片',
        });
      }

      const uploadService = getUploadService();
      const results: ProcessedImage[] = [];

      for (const file of files) {
        const fileBuffer = await fs.readFile(file.path);
        const result = await uploadService.processImage(fileBuffer, {
          filename: file.originalname,
          mimeType: file.mimetype,
          generateVariants: true,
        });
        results.push(result);
      }

      uploadLogger.info('批量图片上传成功', {
        count: results.length,
        totalSize: results.reduce((sum, r) => sum + r.size, 0),
      });

      return res.status(201).json(
        successResponse({
          count: results.length,
          images: results.map((result) => ({
            id: result.id,
            filename: result.filename,
            originalName: result.originalName,
            url: result.cdnPath,
            urls: {
              original: result.cdnPath,
              thumbnail: result.variants.find((v) => v.name === 'thumbnail')?.cdnPath,
              medium: result.variants.find((v) => v.name === 'medium')?.cdnPath,
              large: result.variants.find((v) => v.name === 'large')?.cdnPath,
            },
            size: result.size,
            compressionRatio: result.compressionRatio,
            width: result.width,
            height: result.height,
            format: result.format,
          })),
        })
      );
    } catch (error) {
      next(error);
    } finally {
      await cleanupTempFiles(files);
    }
  }
);

/**
 * POST /api/upload/compress
 * 仅压缩图片 (返回压缩后的数据，不保存)
 */
router.post(
  '/compress',
  requireAuth,
  upload.single('image'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请选择要压缩的图片',
        });
      }

      const {
        format = 'webp',
        quality = 80,
        maxWidth = 1920,
        maxHeight = 1920,
      } = req.body;

      const uploadService = getUploadService();
      const fileBuffer = await fs.readFile(req.file.path);
      const compressed = await uploadService.compressImage(fileBuffer, {
        format,
        quality: parseInt(quality, 10) || 80,
        maxWidth: parseInt(maxWidth, 10) || 1920,
        maxHeight: parseInt(maxHeight, 10) || 1920,
      });

      // 返回压缩后的图片
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="compressed.${format}"`
      );
      res.setHeader('X-Original-Size', req.file.size.toString());
      res.setHeader('X-Compressed-Size', compressed.length.toString());
      res.setHeader(
        'X-Compression-Ratio',
        (compressed.length / req.file.size).toFixed(2)
      );

      return res.send(compressed);
    } catch (error) {
      next(error);
    } finally {
      await cleanupTempFiles(req.file ? [req.file] : []);
    }
  }
);

/**
 * GET /api/upload/:id
 * 获取图片信息 (元数据)
 */
router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // TODO: 从数据库获取图片信息
      // 这里需要根据实际存储方案实现

      return res.status(404).json({
        success: false,
        error: '图片不存在或已删除',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/upload/:id
 * 删除图片
 */
router.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // TODO: 从数据库获取图片信息并删除
      // 这里需要根据实际存储方案实现

      uploadLogger.info('图片删除请求', { id });

      return res.status(404).json({
        success: false,
        error: '图片不存在或已删除',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 获取上传配置
 */
router.get(
  '/config/options',
  requireAuth,
  (req: Request, res: Response) => {
    const uploadService = getUploadService();
    const config = uploadService.getConfig();

    return res.json(
      successResponse({
        maxFileSize: config.maxFileSize,
        maxFileSizeMB: config.maxFileSize / 1024 / 1024,
        allowedMimeTypes: config.allowedMimeTypes,
        sizes: config.sizes,
        cdnPrefix: config.cdnPrefix,
      })
    );
  }
);

// ============== 错误处理 ==============

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  uploadLogger.error('上传路由错误', err);

  return res.status(500).json({
    success: false,
    error: '服务器内部错误，请稍后重试',
  });
});

export default router;
