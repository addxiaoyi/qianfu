// server/intelligent-probe/utils/validation.ts
import { ZodError } from 'zod';
import dns from 'dns';
import { promisify } from 'util';
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
/**
 * Resolves all IP addresses for a hostname and checks if any are private
 */
export const isSafeHostname = async (hostname) => {
    if (!hostname || typeof hostname !== 'string')
        return false;
    // If it's already an IP, just check it
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
        return !isPrivateIP(hostname);
    }
    try {
        const [ipv4, ipv6] = await Promise.all([
            resolve4(hostname).catch(() => []),
            resolve6(hostname).catch(() => [])
        ]);
        const allIps = [...ipv4, ...ipv6];
        if (allIps.length === 0)
            return true; // No IPs found, might be invalid but not private
        return allIps.every(ip => !isPrivateIP(ip));
    }
    catch (error) {
        // If resolution fails, we assume it's not a private IP we can reach
        return true;
    }
};
/**
 * Validate if the hostname is valid
 * @param host - Hostname to be validated
 * @returns ValidationError object if invalid, otherwise null
 */
export const validateHost = (host) => {
    if (!host || typeof host !== 'string' || host.trim() === '') {
        return { message: 'Hostname cannot be empty' };
    }
    // Simple regex validation, allows domain or IP address, optional port
    // Allowed formats: example.com, 192.168.1.1, example.com:25565, 192.168.1.1:25565
    const hostRegex = /^([a-zA-Z0-9.-]+)(:\d{1,5})?$/;
    if (!hostRegex.test(host)) {
        return { message: 'Invalid hostname format' };
    }
    const hostname = host.split(':')[0];
    if (isPrivateIP(hostname)) {
        return { message: 'Access to internal network addresses is forbidden' };
    }
    return null;
};
/**
 * Check if IP address is a private IP or local loopback address
 * @param ip - IP address to be checked
 * @returns true if it is a private IP
 */
export const isPrivateIP = (ip) => {
    if (!ip || typeof ip !== 'string')
        return true;
    // Standardize IPv6 and handle localhost
    const ipv6 = ip.toLowerCase().trim();
    if (ipv6 === 'localhost' || ipv6 === '127.0.0.1' || ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1')
        return true;
    if (ipv6.startsWith('::ffff:')) {
        const mappedV4 = ipv6.substring(7);
        return isPrivateIP(mappedV4);
    }
    // Handle IPv4-compatible IPv6 (::127.0.0.1)
    if (ipv6.startsWith('::') && ipv6.includes('.') && ipv6.split(':').length === 3) {
        const mappedV4 = ipv6.substring(2);
        return isPrivateIP(mappedV4);
    }
    // Handle Integer IP format
    if (/^\d+$/.test(ipv6)) {
        try {
            const intVal = BigInt(ipv6);
            if (intVal >= 0n && intVal <= 0xffffffffn) {
                const parts = [
                    Number((intVal >> 24n) & 0xffn),
                    Number((intVal >> 16n) & 0xffn),
                    Number((intVal >> 8n) & 0xffn),
                    Number(intVal & 0xffn)
                ];
                return isPrivateIP(parts.join('.'));
            }
        }
        catch (e) { }
    }
    // Check for IPv4
    const ipv4Parts = ipv6.split('.');
    if (ipv4Parts.length === 4) {
        try {
            const parts = ipv4Parts.map(part => {
                if (part.startsWith('0x'))
                    return parseInt(part, 16);
                if (part.startsWith('0') && part.length > 1 && !part.includes('.'))
                    return parseInt(part, 8);
                return parseInt(part, 10);
            });
            if (parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
                const [first, second] = parts;
                // 127.0.0.0/8 (Loopback)
                if (first === 127)
                    return true;
                // 10.0.0.0/8 (Private)
                if (first === 10)
                    return true;
                // 172.16.0.0/12 (Private)
                if (first === 172 && second >= 16 && second <= 31)
                    return true;
                // 192.168.0.0/16 (Private)
                if (first === 192 && second === 168)
                    return true;
                // 0.0.0.0/8 (Current network)
                if (first === 0)
                    return true;
                // 169.254.0.0/16 (Link-local)
                if (first === 169 && second === 254)
                    return true;
                return false;
            }
        }
        catch (e) { }
    }
    // Handle IPv6 (basic check for common private/local ranges)
    if (ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1')
        return true; // loopback
    if (ipv6.startsWith('fe80:'))
        return true; // link-local
    if (ipv6.startsWith('fc00:') || ipv6.startsWith('fd00:'))
        return true; // unique local
    if (ipv6 === '::' || ipv6 === '0:0:0:0:0:0:0:0')
        return true; // unspecified
    if (ipv6.startsWith('ff'))
        return true; // multicast
    return false;
};
/**
 * Validate if a URL is safe (not pointing to a private address)
 * @param urlString - URL to be validated
 * @returns ValidationError object if invalid, otherwise null
 */
export const validateUrl = (urlString) => {
    if (!urlString || typeof urlString !== 'string')
        return null;
    try {
        const url = new URL(urlString);
        const hostname = url.hostname;
        if (isPrivateIP(hostname)) {
            return { message: 'URL points to a forbidden internal address' };
        }
        return null;
    }
    catch (e) {
        return { message: 'Invalid URL format' };
    }
};
export const validate = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof ZodError) {
            // You might want to format the error details more nicely
            throw new Error(`Validation failed: ${error.issues.map((e) => e.message).join(', ')}`);
        }
        throw error;
    }
};
//# sourceMappingURL=validation.js.map