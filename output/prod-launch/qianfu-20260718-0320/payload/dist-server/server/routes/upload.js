import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { authenticate } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/emailVerifiedGuard.js';
import { csrfProtection } from '../middleware/csrf.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { logAction } from '../services/auditService.js';
import { uploadSchema } from '../utils/validation.js';
import { UploadService } from '../services/uploadService.js';
import { UPLOAD_CONFIG } from '../config/upload.js';
import { AppError, ErrorCode } from '../utils/errors.js';
const router = Router();
const MAX_BASE64_UPLOAD_SIZE = UPLOAD_CONFIG.maxBase64FileSize;
const safeOriginalName = (value) => {
    const normalized = String(value || 'upload').replace(/\\/g, '/').split('/').pop() || 'upload';
    return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'upload';
};
// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: UPLOAD_CONFIG.maxFileSize,
    },
    fileFilter: (req, file, cb) => {
        const kind = String(req.body?.kind || 'image').toLowerCase();
        const allowedMimes = kind === 'asset' ? UPLOAD_CONFIG.allowedAssetMimeTypes : UPLOAD_CONFIG.allowedImageMimeTypes;
        const allowedExtensions = kind === 'asset' ? UPLOAD_CONFIG.allowedAssetExtensions : UPLOAD_CONFIG.allowedImageExtensions;
        const name = (file.originalname || '').toLowerCase();
        const extOk = allowedExtensions.some(ext => name.endsWith(ext));
        if (allowedMimes.includes(file.mimetype) && extOk)
            return cb(null, true);
        // In multipart forms, fields appended after the file are not guaranteed to
        // be visible to multer's fileFilter yet. Let plausible marketplace assets
        // reach UploadService, where kind-specific MIME/content checks still run.
        const assetExtOk = UPLOAD_CONFIG.allowedAssetExtensions.some(ext => name.endsWith(ext));
        const assetMimeOk = UPLOAD_CONFIG.allowedAssetMimeTypes.includes(file.mimetype);
        if (kind === 'image' && assetExtOk && assetMimeOk)
            return cb(null, true);
        cb(new Error(kind === 'asset' ? 'Invalid file type. Only marketplace assets are allowed.' : 'Invalid file type. Only images are allowed.'));
    }
});
// Middleware to handle multer errors
const handleUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err instanceof MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new AppError('File size too large. Max 50MB allowed.', 400, ErrorCode.VALIDATION_ERROR));
                }
                return next(new AppError(err.message, 400, ErrorCode.VALIDATION_ERROR));
            }
            else if (err.message === 'Invalid file type. Only images are allowed.' || err.message === 'Invalid file type. Only marketplace assets are allowed.') {
                return next(new AppError(err.message, 400, ErrorCode.VALIDATION_ERROR));
            }
            return next(err);
        }
        next();
    });
};
function parseDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m)
        return null;
    return { mime: m[1], base64: m[2] };
}
router.post('/upload', authenticate, requireVerifiedEmail, uploadLimiter, csrfProtection, handleUpload, async (req, res, next) => {
    try {
        const user = req.user;
        const adminId = user?.id ?? (req.isAdmin ? 0 : null);
        let buffer;
        let filename;
        // Handle multipart/form-data
        if (req.file) {
            buffer = req.file.buffer;
            filename = safeOriginalName(req.file.originalname);
        }
        // Handle base64/dataUrl (Legacy support)
        else if (req.body && (req.body.dataUrl || req.body.base64)) {
            const validation = uploadSchema.safeParse(req.body);
            if (validation.success) {
                const { filename: bodyFilename, dataUrl, base64 } = validation.data;
                let fileBase64 = base64;
                filename = bodyFilename;
                if (typeof dataUrl === 'string') {
                    const parsed = parseDataUrl(dataUrl);
                    if (parsed) {
                        if (!UPLOAD_CONFIG.allowedImageMimeTypes.includes(parsed.mime)) {
                            throw new AppError('Invalid data URL MIME type', 400, ErrorCode.VALIDATION_ERROR);
                        }
                        fileBase64 = parsed.base64;
                    }
                }
                if (fileBase64) {
                    buffer = Buffer.from(fileBase64, 'base64');
                    filename = safeOriginalName(filename);
                }
            }
        }
        if (!buffer) {
            throw new AppError('Missing file data', 400, ErrorCode.VALIDATION_ERROR);
        }
        // Validate File Size (Double check for base64)
        const kind = String(req.body?.kind || 'image').toLowerCase();
        const maxSize = kind === 'asset' ? UPLOAD_CONFIG.maxFileSize : MAX_BASE64_UPLOAD_SIZE;
        if (buffer.length > maxSize) {
            throw new AppError(`File size too large. Max ${Math.floor(maxSize / 1024 / 1024)}MB allowed.`, 400, ErrorCode.VALIDATION_ERROR);
        }
        const result = kind === 'asset'
            ? await UploadService.processAndSaveAsset(buffer, filename || 'upload')
            : await UploadService.processAndSaveImage(buffer, filename || 'upload', user?.id);
        await logAction(adminId === 0 ? null : adminId, 'UPLOAD_FILE', 'file', req, {
            originalName: filename,
            finalName: result.filename,
            size: result.size,
            mime: result.mime
        });
        return res.status(200).json({
            success: true,
            message: 'Upload successful',
            data: {
                url: result.url,
                size: result.size,
                mime: result.mime,
                filename: result.filename,
                kind: String(req.body?.kind || 'image')
            }
        });
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=upload.js.map