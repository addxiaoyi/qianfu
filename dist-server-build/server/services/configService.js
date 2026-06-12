import prisma from '../db.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { redisService } from './redisService.js';
// AES-256-CBC Encryption for sensitive configuration
const ALGORITHM = 'aes-256-cbc';
const CONFIG_CACHE_PREFIX = 'config:';
const CONFIG_CACHE_TTL = 3600; // 1 hour
const ENCRYPTION_KEY = process.env.MODERATION_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    logger.warn('[ConfigService] MODERATION_ENCRYPTION_KEY is missing. Configuration encryption will be unavailable.');
}
const IV_LENGTH = 16;
function getEncryptionKeyBuffer() {
    if (!ENCRYPTION_KEY)
        return null;
    return Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
}
function encrypt(text) {
    const key = getEncryptionKeyBuffer();
    if (!key) {
        throw new Error('MODERATION_ENCRYPTION_KEY is unavailable');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decrypt(text) {
    const key = getEncryptionKeyBuffer();
    if (!key) {
        throw new Error('MODERATION_ENCRYPTION_KEY is unavailable');
    }
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
/**
 * Retrieve system configuration
 */
export async function getConfig(key, decryptValue = false) {
    try {
        const cacheKey = `${CONFIG_CACHE_PREFIX}${key}`;
        const cached = await redisService.get(cacheKey);
        if (cached !== null) {
            if (decryptValue && cached.startsWith('enc:')) {
                return decrypt(cached.slice(4));
            }
            return cached;
        }
        const config = await prisma.systemConfig.findUnique({
            where: { key }
        });
        if (!config)
            return null;
        // Store in cache
        const cacheValue = config.is_secret ? `enc:${config.value}` : config.value;
        await redisService.set(cacheKey, cacheValue, CONFIG_CACHE_TTL);
        if (config.is_secret && decryptValue) {
            return decrypt(config.value);
        }
        return config.value;
    }
    catch (error) {
        return null;
    }
}
/**
 * Update system configuration
 */
export async function setConfig(key, value, isSecret = false, description) {
    try {
        const finalValue = isSecret ? encrypt(value) : value;
        await prisma.systemConfig.upsert({
            where: { key },
            update: {
                value: finalValue,
                is_secret: isSecret,
                description
            },
            create: {
                key,
                value: finalValue,
                is_secret: isSecret,
                description
            }
        });
        // Invalidate cache
        await redisService.del(`${CONFIG_CACHE_PREFIX}${key}`);
    }
    catch (error) {
        // Error handling
    }
}
/**
 * Retrieve all moderation-related configurations
 */
export async function getModerationConfigs() {
    const configs = await prisma.systemConfig.findMany({
        where: {
            key: { startsWith: 'MODERATION_' }
        }
    });
    return configs.map(c => ({
        key: c.key,
        value: c.is_secret ? '********' : c.value,
        description: c.description,
        updatedAt: c.updated_at
    }));
}
//# sourceMappingURL=configService.js.map