import { ZodSchema } from 'zod';
/**
 * Resolves all IP addresses for a hostname and checks if any are private
 */
export declare const isSafeHostname: (hostname: string) => Promise<boolean>;
interface ValidationError {
    message: string;
}
/**
 * Validate if the hostname is valid
 * @param host - Hostname to be validated
 * @returns ValidationError object if invalid, otherwise null
 */
export declare const validateHost: (host: string) => ValidationError | null;
/**
 * Check if IP address is a private IP or local loopback address
 * @param ip - IP address to be checked
 * @returns true if it is a private IP
 */
export declare const isPrivateIP: (ip: string) => boolean;
/**
 * Validate if a URL is safe (not pointing to a private address)
 * @param urlString - URL to be validated
 * @returns ValidationError object if invalid, otherwise null
 */
export declare const validateUrl: (urlString: string) => ValidationError | null;
export declare const validate: <T>(schema: ZodSchema<T>, data: any) => T;
export {};
//# sourceMappingURL=validation.d.ts.map