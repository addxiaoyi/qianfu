import crypto from 'crypto';
import { logger } from './logger';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (key.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}
function getMasterKey() {
    const key = process.env.MASTER_KEY;
    if (!key) {
        throw new Error('MASTER_KEY environment variable is not set');
    }
    if (key.length < 32) {
        throw new Error('MASTER_KEY must be at least 32 characters long');
    }
    return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}
export function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}
export function encrypt(plaintext, key) {
    const encryptionKey = key || getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const derivedKey = deriveKey(encryptionKey, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
    };
}
export function decrypt(encryptedData, key) {
    const encryptionKey = key || getEncryptionKey();
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const derivedKey = deriveKey(encryptionKey, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
export function encryptString(plaintext) {
    const result = encrypt(plaintext);
    return JSON.stringify(result);
}
export function decryptString(encryptedString) {
    const result = JSON.parse(encryptedString);
    return decrypt(result);
}
export function hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}
export function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}
export function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}
export function generateApiKey(prefix = 'mk') {
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomPart}`;
}
export function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
export function hashDataWithSalt(data) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return { hash, salt };
}
export function verifyHash(data, salt, hash) {
    const verifyHash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}
export function encryptObject(obj, keysToEncrypt) {
    const encrypted = { ...obj };
    for (const key of keysToEncrypt) {
        if (encrypted[key] !== undefined && encrypted[key] !== null) {
            const value = String(encrypted[key]);
            encrypted[key] = encryptString(value);
        }
    }
    return encrypted;
}
export function decryptObject(obj, keysToDecrypt) {
    const decrypted = { ...obj };
    for (const key of keysToDecrypt) {
        if (decrypted[key] !== undefined && decrypted[key] !== null) {
            const value = String(decrypted[key]);
            try {
                decrypted[key] = decryptString(value);
            }
            catch {
                logger.warn(`[Encryption] Failed to decrypt field: ${String(key)}`);
            }
        }
    }
    return decrypted;
}
export function encryptSensitiveFields(data, sensitiveFields) {
    const encrypted = { ...data };
    for (const field of sensitiveFields) {
        if (encrypted[field] !== undefined && encrypted[field] !== null) {
            const value = String(encrypted[field]);
            encrypted[field] = encryptString(value);
        }
    }
    return encrypted;
}
export function decryptSensitiveFields(data, sensitiveFields) {
    const decrypted = { ...data };
    for (const field of sensitiveFields) {
        if (decrypted[field] !== undefined && decrypted[field] !== null) {
            const value = String(decrypted[field]);
            try {
                decrypted[field] = decryptString(value);
            }
            catch {
                logger.warn(`[Encryption] Failed to decrypt field: ${field}`);
            }
        }
    }
    return decrypted;
}
export function createDataSignature(data) {
    const masterKey = getMasterKey();
    const signature = crypto.createHmac('sha256', masterKey).update(data).digest('hex');
    return signature;
}
export function verifyDataSignature(data, signature) {
    const expectedSignature = createDataSignature(data);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
export function signAndEncrypt(data) {
    const jsonData = JSON.stringify(data);
    const signature = createDataSignature(jsonData);
    const encrypted = encryptString(jsonData);
    return { signature, encrypted };
}
export function decryptAndVerify(encryptedData, signature) {
    try {
        const decrypted = decryptString(encryptedData);
        if (!verifyDataSignature(decrypted, signature)) {
            logger.warn('[Encryption] Signature verification failed');
            return null;
        }
        return JSON.parse(decrypted);
    }
    catch (error) {
        logger.error('[Encryption] Decryption or verification failed:', { error });
        return null;
    }
}
export function maskSensitiveData(data, visibleChars = 4) {
    if (data.length <= visibleChars * 2) {
        return '*'.repeat(data.length);
    }
    const visible = data.slice(0, visibleChars);
    const masked = '*'.repeat(data.length - visibleChars * 2);
    const endVisible = data.slice(-visibleChars);
    return `${visible}${masked}${endVisible}`;
}
export function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
        return `${localPart[0]}***@${domain}`;
    }
    const visible = localPart.slice(0, 2);
    const masked = '*'.repeat(localPart.length - 2);
    return `${visible}${masked}@${domain}`;
}
export function maskPhoneNumber(phone) {
    if (phone.length < 7) {
        return '*'.repeat(phone.length);
    }
    const visible = phone.slice(0, 3);
    const masked = '*'.repeat(phone.length - 7);
    const endVisible = phone.slice(-4);
    return `${visible}${masked}${endVisible}`;
}
export function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
//# sourceMappingURL=encryption.js.map