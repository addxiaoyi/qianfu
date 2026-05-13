import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

interface DecryptionInput {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) {
    throw new Error('MASTER_KEY environment variable is not set');
  }
  if (key.length < 32) {
    throw new Error('MASTER_KEY must be at least 32 characters long');
  }
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}

export function deriveKey(password: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(plaintext: string, key?: Buffer): EncryptionResult {
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

export function decrypt(encryptedData: DecryptionInput, key?: Buffer): string {
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

export function encryptString(plaintext: string): string {
  const result = encrypt(plaintext);
  return JSON.stringify(result);
}

export function decryptString(encryptedString: string): string {
  const result = JSON.parse(encryptedString) as DecryptionInput;
  return decrypt(result);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateApiKey(prefix: string = 'mk'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${randomPart}`;
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hashDataWithSalt(data: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyHash(data: string, salt: string, hash: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

export function encryptObject<T extends object>(obj: T, keysToEncrypt: (keyof T)[]): T {
  const encrypted = { ...obj };
  for (const key of keysToEncrypt) {
    if (encrypted[key] !== undefined && encrypted[key] !== null) {
      const value = String(encrypted[key]);
      encrypted[key] = encryptString(value) as T[keyof T];
    }
  }
  return encrypted;
}

export function decryptObject<T extends object>(obj: T, keysToDecrypt: (keyof T)[]): T {
  const decrypted = { ...obj };
  for (const key of keysToDecrypt) {
    if (decrypted[key] !== undefined && decrypted[key] !== null) {
      const value = String(decrypted[key]);
      try {
        decrypted[key] = decryptString(value) as T[keyof T];
      } catch {
        logger.warn(`[Encryption] Failed to decrypt field: ${String(key)}`);
      }
    }
  }
  return decrypted;
}

export function encryptSensitiveFields(data: Record<string, unknown>, sensitiveFields: string[]): Record<string, unknown> {
  const encrypted = { ...data };
  for (const field of sensitiveFields) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      const value = String(encrypted[field]);
      encrypted[field] = encryptString(value);
    }
  }
  return encrypted;
}

export function decryptSensitiveFields(data: Record<string, unknown>, sensitiveFields: string[]): Record<string, unknown> {
  const decrypted = { ...data };
  for (const field of sensitiveFields) {
    if (decrypted[field] !== undefined && decrypted[field] !== null) {
      const value = String(decrypted[field]);
      try {
        decrypted[field] = decryptString(value);
      } catch {
        logger.warn(`[Encryption] Failed to decrypt field: ${field}`);
      }
    }
  }
  return decrypted;
}

export function createDataSignature(data: string): string {
  const masterKey = getMasterKey();
  const signature = crypto.createHmac('sha256', masterKey).update(data).digest('hex');
  return signature;
}

export function verifyDataSignature(data: string, signature: string): boolean {
  const expectedSignature = createDataSignature(data);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export function signAndEncrypt(data: Record<string, unknown>): { signature: string; encrypted: string } {
  const jsonData = JSON.stringify(data);
  const signature = createDataSignature(jsonData);
  const encrypted = encryptString(jsonData);
  return { signature, encrypted };
}

export function decryptAndVerify(encryptedData: string, signature: string): Record<string, unknown> | null {
  try {
    const decrypted = decryptString(encryptedData);
    if (!verifyDataSignature(decrypted, signature)) {
      logger.warn('[Encryption] Signature verification failed');
      return null;
    }
    return JSON.parse(decrypted) as Record<string, unknown>;
  } catch (error) {
    logger.error('[Encryption] Decryption or verification failed:', { error });
    return null;
  }
}

export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  const visible = data.slice(0, visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);
  const endVisible = data.slice(-visibleChars);
  return `${visible}${masked}${endVisible}`;
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  const visible = localPart.slice(0, 2);
  const masked = '*'.repeat(localPart.length - 2);
  return `${visible}${masked}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 7) {
    return '*'.repeat(phone.length);
  }
  const visible = phone.slice(0, 3);
  const masked = '*'.repeat(phone.length - 7);
  const endVisible = phone.slice(-4);
  return `${visible}${masked}${endVisible}`;
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
