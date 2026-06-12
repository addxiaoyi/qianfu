import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { fileURLToPath } from 'url';
import { UPLOAD_CONFIG } from '../config/upload';

const __filenameResolved = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
const __dirnameResolved = __filenameResolved ? path.dirname(__filenameResolved) : (typeof __dirname !== 'undefined' ? __dirname : '');

const MAX_FILE_SIZE = UPLOAD_CONFIG.maxFileSize;
const ALLOWED_IMAGE_MIME_TYPES = UPLOAD_CONFIG.allowedImageMimeTypes;
const ALLOWED_ASSET_MIME_TYPES = UPLOAD_CONFIG.allowedAssetMimeTypes;
const MAX_IMAGE_DIMENSION = UPLOAD_CONFIG.maxImageDimension;
const ASSET_EXTENSION_MIME_ALLOWLIST: Record<string, string[]> = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.jar': ['application/java-archive', 'application/zip', 'application/x-zip-compressed'],
  '.json': ['application/json', 'text/plain'],
  '.txt': ['text/plain'],
  '.md': ['text/plain', 'text/markdown'],
  '.schem': ['application/octet-stream', 'application/gzip', 'application/nbt', 'application/x-nbt', 'application/x-schematic'],
  '.schematic': ['application/octet-stream', 'application/gzip', 'application/nbt', 'application/x-nbt', 'application/x-schematic'],
};

import { ModerationService } from './moderationService';

export interface UploadResult {
  url: string;
  size: number;
  mime: string;
  filename: string;
}

export class UploadService {
  private static readonly uploadsDir = path.resolve(__dirnameResolved, '../../uploads');

  static ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  static async scanForViruses(buffer: Buffer): Promise<boolean> {
    const content = buffer.toString('utf8', 0, 8192);
    const suspiciousPatterns = [
      '<?php', '<?=', '<%', '<script', 'javascript:', 'vbscript:',
      'onload=', 'onerror=', 'onclick=', 'onmouseover=', 'eval(',
      'base64_decode', 'passthru', 'shell_exec', 'system(', 'assert(',
      'preg_replace', 'create_function', 'include(', 'require(',
      '$_get', '$_post', '$_request', '$_cookie', '$_files',
      'python', 'import os', 'subprocess', 'nc -e', '/bin/sh', '/bin/bash',
      'powershell', 'Add-Type', 'New-Object', 'WScript.Shell'
    ];

    const lowerContent = content.toLowerCase();
    for (const pattern of suspiciousPatterns) {
      if (lowerContent.includes(pattern)) return false;
    }

    let nullCount = 0;
    const checkLength = Math.min(buffer.length, 4096);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) nullCount++;
    }
    if (nullCount > checkLength * 0.05) return false;
    return true;
  }

  private static checkMagicNumbers(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;
    const hex = buffer.toString('hex', 0, 4).toUpperCase();
    if (hex === '89504E47') return 'image/png';
    if (hex.startsWith('FFD8FF')) return 'image/jpeg';
    if (hex === '47494638') return 'image/gif';
    if (hex === '52494646' && buffer.toString('utf8', 8, 12) === 'WEBP') return 'image/webp';
    return null;
  }

  private static detectAssetMime(buffer: Buffer, filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (['.zip'].includes(ext)) return 'application/zip';
    if (['.jar'].includes(ext)) return 'application/java-archive';
    if (['.json'].includes(ext)) return 'application/json';
    if (['.txt', '.md'].includes(ext)) return 'text/plain';
    if (['.schem', '.schematic'].includes(ext)) return 'application/octet-stream';
    return 'application/octet-stream';
  }

  private static isAssetMimeCompatible(ext: string, mime: string): boolean {
    const compatibleMimes = ASSET_EXTENSION_MIME_ALLOWLIST[ext];
    return Boolean(compatibleMimes?.includes(mime));
  }

  static async processAndSaveImage(buffer: Buffer, originalFilename: string, userId?: number): Promise<UploadResult> {
    const isSafe = await this.scanForViruses(buffer);
    if (!isSafe) throw new Error('File failed virus scan');

    const type = await fileTypeFromBuffer(buffer);
    const manualMime = this.checkMagicNumbers(buffer);
    const finalMime = type?.mime || manualMime;

    if (!finalMime || !ALLOWED_IMAGE_MIME_TYPES.includes(finalMime)) {
      throw new Error('Invalid file type. Only images (PNG, JPEG, GIF, WEBP) are allowed.');
    }

    const ext = path.extname(originalFilename).toLowerCase();
    const isJpeg = finalMime === 'image/jpeg' || finalMime === 'image/jpg';
    const allowedJpegExts = ['.jpg', '.jpeg'];
    if (ext !== '') {
      const isExtensionMatch = isJpeg ? allowedJpegExts.includes(ext) : ext === `.${finalMime.split('/')[1]}`;
      if (!isExtensionMatch) {
        throw new Error(`Security Alert: File extension ${ext} does not match detected content type ${finalMime}`);
      }
    }

    const base64Image = `data:${finalMime};base64,${buffer.toString('base64')}`;
    const moderationResult = await ModerationService.checkImage(base64Image, userId);
    if (!moderationResult.passed) throw new Error(moderationResult.reason || 'Image content violates safety guidelines');

    let sharpInstance = sharp(buffer, { failOnError: false, animated: true });
    const metadata = await sharpInstance.metadata();
    if (metadata.width && (metadata.width > MAX_IMAGE_DIMENSION) || (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)) {
      sharpInstance = sharpInstance.resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true });
    }
    sharpInstance = sharpInstance.rotate();
    if (finalMime === 'image/jpeg' || finalMime === 'image/jpg') {
      sharpInstance = sharpInstance.jpeg({ quality: 80, mozjpeg: true, progressive: true, trellisQuantisation: true, overshootDeringing: true });
    } else if (finalMime === 'image/png') {
      sharpInstance = sharpInstance.png({ compressionLevel: 9, palette: true, quality: 80 });
    } else if (finalMime === 'image/webp') {
      sharpInstance = sharpInstance.webp({ quality: 75, effort: 6, smartSubsample: true });
    } else if (finalMime === 'image/gif') {
      sharpInstance = sharpInstance.gif({ effort: 7, colors: 256 });
    }

    const processedBuffer = await sharpInstance.toBuffer();
    if (processedBuffer.length > MAX_FILE_SIZE) throw new Error('Processed file size too large');

    const randomName = crypto.randomUUID();
    const safeExt = finalMime.split('/')[1] === 'jpeg' ? 'jpg' : finalMime.split('/')[1];
    const finalFileName = `${randomName}.${safeExt}`;
    const finalAbsPath = path.join(this.uploadsDir, finalFileName);
    if (!finalAbsPath.startsWith(this.uploadsDir)) throw new Error('Invalid file path calculation');

    this.ensureUploadsDir();
    fs.writeFileSync(finalAbsPath, processedBuffer);

    return { url: `/uploads/${finalFileName}`, size: processedBuffer.length, mime: finalMime, filename: finalFileName };
  }

  static async processAndSaveAsset(buffer: Buffer, originalFilename: string): Promise<UploadResult> {
    const isSafe = await this.scanForViruses(buffer);
    if (!isSafe) throw new Error('File failed virus scan');

    const type = await fileTypeFromBuffer(buffer);
    const finalMime = type?.mime || this.detectAssetMime(buffer, originalFilename);
    const ext = path.extname(originalFilename).toLowerCase();
    if (!ext || !UPLOAD_CONFIG.allowedAssetExtensions.includes(ext)) {
      throw new Error(`Unsupported asset extension: ${ext}`);
    }
    if (!ALLOWED_ASSET_MIME_TYPES.includes(finalMime)) {
      throw new Error(`Unsupported asset mime type: ${finalMime}`);
    }
    if (!this.isAssetMimeCompatible(ext, finalMime)) {
      throw new Error(`Security Alert: File extension ${ext} does not match detected content type ${finalMime}`);
    }

    this.ensureUploadsDir();
    const randomName = crypto.randomUUID();
    const safeExt = ext || (finalMime === 'application/java-archive' ? '.jar' : finalMime === 'application/zip' ? '.zip' : '.bin');
    const finalFileName = `${randomName}${safeExt}`;
    const finalAbsPath = path.join(this.uploadsDir, finalFileName);
    if (!finalAbsPath.startsWith(this.uploadsDir)) throw new Error('Invalid file path calculation');
    fs.writeFileSync(finalAbsPath, buffer);

    return { url: `/uploads/${finalFileName}`, size: buffer.length, mime: finalMime, filename: finalFileName };
  }
}
