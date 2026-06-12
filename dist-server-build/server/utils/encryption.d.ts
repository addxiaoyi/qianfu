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
export declare function deriveKey(password: Buffer, salt: Buffer): Buffer;
export declare function encrypt(plaintext: string, key?: Buffer): EncryptionResult;
export declare function decrypt(encryptedData: DecryptionInput, key?: Buffer): string;
export declare function encryptString(plaintext: string): string;
export declare function decryptString(encryptedString: string): string;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, storedHash: string): boolean;
export declare function generateSecureToken(length?: number): string;
export declare function generateApiKey(prefix?: string): string;
export declare function hashData(data: string): string;
export declare function hashDataWithSalt(data: string): {
    hash: string;
    salt: string;
};
export declare function verifyHash(data: string, salt: string, hash: string): boolean;
export declare function encryptObject<T extends object>(obj: T, keysToEncrypt: (keyof T)[]): T;
export declare function decryptObject<T extends object>(obj: T, keysToDecrypt: (keyof T)[]): T;
export declare function encryptSensitiveFields(data: Record<string, unknown>, sensitiveFields: string[]): Record<string, unknown>;
export declare function decryptSensitiveFields(data: Record<string, unknown>, sensitiveFields: string[]): Record<string, unknown>;
export declare function createDataSignature(data: string): string;
export declare function verifyDataSignature(data: string, signature: string): boolean;
export declare function signAndEncrypt(data: Record<string, unknown>): {
    signature: string;
    encrypted: string;
};
export declare function decryptAndVerify(encryptedData: string, signature: string): Record<string, unknown> | null;
export declare function maskSensitiveData(data: string, visibleChars?: number): string;
export declare function maskEmail(email: string): string;
export declare function maskPhoneNumber(phone: string): string;
export declare function secureCompare(a: string, b: string): boolean;
export {};
//# sourceMappingURL=encryption.d.ts.map