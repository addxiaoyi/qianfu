export const DEFAULT_SENSITIVE_FIELDS = [
    'password', 'passwd', 'pass', 'token', 'accessToken', 'access_token',
    'refreshToken', 'refresh_token', 'bearerToken', 'apiKey', 'api_key',
    'apiSecret', 'api_secret', 'appKey', 'app_key', 'appSecret', 'app_secret',
    'clientSecret', 'client_secret', 'secret', 'secretKey', 'privateKey',
    'private_key', 'publicKey', 'public_key',
    'sessionId', 'session_id', 'sessionToken', 'session_token', 'session',
    'sid', 'ssid', 'cookie', 'cookies',
    'authorization', 'auth', 'authToken', 'auth_token', 'basicAuth',
    'csrfToken', 'csrf_token', 'csrf', 'xsrfToken', 'xsrf_token', 'nonce',
    'cardNumber', 'card_number', 'cardNo', 'card_no', 'pan', 'cvv', 'cvc',
    'expiryDate', 'expiry_date', 'billingAddress', 'paymentToken',
    'bankAccount', 'bank_account_number', 'accountNumber', 'account_number',
    'routingNumber', 'iban', 'swift', 'bic',
    'ssn', 'socialSecurityNumber', 'nationalId', 'idCard', 'identityCard',
    'passport', 'passportNumber', 'driverLicense',
    'phone', 'phoneNumber', 'mobile', 'mobileNumber', 'tel', 'email', 'emailAddress',
    'resetToken', 'recoveryToken', 'verificationCode', 'verifyCode', 'otp',
    'fingerprint', 'faceId', 'biometric',
];
const DEFAULT_MASKING_RULES = [
    { pattern: /^(password|passwd|pass|pin)$/i, replacement: '[PASSWORD]', prefixLength: 0, suffixLength: 0 },
    { pattern: /^(token|accessToken|refreshToken|bearerToken|authToken|sessionToken|apiKey)$/i, prefixLength: 4, suffixLength: 4 },
    { pattern: /^(apiSecret|appSecret|clientSecret|secret)$/i, prefixLength: 6, suffixLength: 4 },
    { pattern: /^(cardNumber|pan|accountNumber|creditCard|debitCard)$/i, prefixLength: 4, suffixLength: 4 },
    { pattern: /^(cvv|cvc)$/i, replacement: '[CVV]', prefixLength: 0, suffixLength: 0 },
    { pattern: /^(ssn|socialSecurityNumber|nationalId|idCard)$/i, prefixLength: 3, suffixLength: 4 },
    { pattern: /^(phone|phoneNumber|mobile|tel)$/i, prefixLength: 3, suffixLength: 4 },
    { pattern: /^email$/i, prefixLength: 2, suffixLength: 0 },
    { pattern: /^(cookie|sessionId|session)$/i, replacement: '[COOKIE]', prefixLength: 0, suffixLength: 0 },
    { pattern: /^authorization$/i, prefixLength: 8, suffixLength: 0 },
];
const SENSITIVE_PATTERNS = [
    { pattern: /(\b1[3-9]\d{9}\b)/g, mask: (m) => m.replace(/(\b1[3-9]\d{1})(\d{4})(\d{4})/, '$1****$3'), description: 'phone' },
    { pattern: /\b(\d{6})(\d{8})(\d{3}[\dXx])\b/g, mask: (m) => m.replace(/(\d{6})(\d{8})(\d{3}[\dXx])/, '$1********$3'), description: 'idCard' },
    { pattern: /\b([a-zA-Z0-9._%+-]{1,3})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, mask: (m) => m.replace(/([a-zA-Z0-9._%+-]{1,3})[a-zA-Z0-9._%+-]*@/, '$1***@'), description: 'email' },
    { pattern: /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, mask: (m) => m.replace(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/, '$1.$2.*.*'), description: 'ip' },
    { pattern: /\b(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)\b/g, mask: () => '[JWT]', description: 'jwt' },
    { pattern: /\b(Bearer\s+)([a-zA-Z0-9_-]+)/gi, mask: (m) => m.replace(/Bearer\s+([a-zA-Z0-9_-]+)/i, 'Bearer ***'), description: 'bearer' },
    { pattern: /(password|passwd|pass|pwd|secret|token)=([^&;\s]+)/gi, mask: (m) => m.replace(/(password|passwd|pass|pwd|secret|token)=([^&;\s]+)/i, '$1=***'), description: 'credential' },
];
function createFieldMatcher(fields) {
    return new Set(fields.map((f) => f.toLowerCase()));
}
function isSensitiveField(fieldName, fieldMatcher) {
    const lowerName = fieldName.toLowerCase();
    if (fieldMatcher.has(lowerName))
        return true;
    const arr = Array.from(fieldMatcher);
    for (const s of arr) {
        if (lowerName.startsWith(s + '_') || lowerName.startsWith(s + '-'))
            return true;
        if (lowerName.endsWith('_' + s) || lowerName.endsWith('-' + s))
            return true;
    }
    return false;
}
function findMatchingRule(fieldName, rules) {
    const lowerName = fieldName.toLowerCase();
    for (const rule of rules) {
        if (typeof rule.pattern === 'string') {
            if (lowerName === rule.pattern.toLowerCase())
                return rule;
        }
        else if (rule.pattern instanceof RegExp) {
            if (rule.pattern.test(fieldName))
                return rule;
        }
    }
    return undefined;
}
function maskStringValue(value, fieldName, fieldMatcher, customRules, options) {
    const replacement = options.replacement || '[REDACTED]';
    const rule = findMatchingRule(fieldName, [...customRules, ...DEFAULT_MASKING_RULES]);
    if (rule) {
        if (rule.customMask)
            return rule.customMask(value);
        if (rule.replacement)
            return rule.replacement;
        const prefixLen = rule.prefixLength ?? 0;
        const suffixLen = rule.suffixLength ?? 4;
        if (prefixLen === 0 && suffixLen === 0)
            return replacement;
        if (value.length <= prefixLen + suffixLen)
            return replacement;
        const maskLen = Math.max(value.length - prefixLen - suffixLen, 3);
        return value.substring(0, prefixLen) + '*'.repeat(maskLen) + (suffixLen > 0 ? value.substring(value.length - suffixLen) : '');
    }
    if (isSensitiveField(fieldName, fieldMatcher)) {
        if (value.length <= 6)
            return replacement;
        return value.substring(0, 3) + '****' + value.substring(value.length - 3);
    }
    return value;
}
function maskObject(obj, fieldMatcher, customRules, options, depth = 0) {
    const found = [];
    const maxDepth = options.maxDepth ?? 10;
    if (depth > maxDepth)
        return { result: '[MAX_DEPTH_EXCEEDED]', found };
    if (obj === null || obj === undefined)
        return { result: obj, found };
    if (Array.isArray(obj)) {
        const masked = [];
        for (const item of obj) {
            const { result, found: sf } = maskObject(item, fieldMatcher, customRules, options, depth + 1);
            masked.push(result);
            found.push(...sf);
        }
        return { result: masked, found };
    }
    if (typeof obj === 'object') {
        const maskedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            if (isSensitiveField(key, fieldMatcher) || findMatchingRule(key, customRules)) {
                const maskedVal = maskStringValue(typeof value === 'string' ? value : JSON.stringify(value), key, fieldMatcher, customRules, options);
                if (options.preserveField ?? true)
                    maskedObj[key] = maskedVal;
                found.push({ path: key, type: 'field', matched: key });
            }
            else if (typeof value === 'object' && value !== null && options.recursive !== false) {
                const { result, found: sf } = maskObject(value, fieldMatcher, customRules, options, depth + 1);
                maskedObj[key] = result;
                found.push(...sf);
            }
            else {
                maskedObj[key] = value;
            }
        }
        return { result: maskedObj, found };
    }
    if (typeof obj === 'string') {
        let result = obj;
        for (const p of SENSITIVE_PATTERNS)
            result = result.replace(p.pattern, p.mask);
        return { result, found };
    }
    return { result: obj, found };
}
function maskStringContent(text, fieldMatcher, customRules, options) {
    const found = [];
    let result = text;
    for (const p of SENSITIVE_PATTERNS) {
        const matches = text.match(p.pattern);
        if (matches) {
            for (const _m of matches)
                found.push({ path: 'string', type: 'pattern', matched: p.description });
            result = result.replace(p.pattern, p.mask);
        }
    }
    return { result, found };
}
export function createMasker(options = {}) {
    const fieldMatcher = createFieldMatcher(DEFAULT_SENSITIVE_FIELDS);
    const customRules = options.customRules ?? [];
    return {
        mask(data) { return maskObject(data, fieldMatcher, customRules, options).result; },
        maskWithResult(data) {
            const { result, found } = maskObject(data, fieldMatcher, customRules, options);
            if (typeof data === 'string') {
                const { result: sr, found: sf } = maskStringContent(data, fieldMatcher, customRules, options);
                return { masked: sr, found: [...found, ...sf] };
            }
            return { masked: result, found };
        },
        maskString(text) { return maskStringContent(text, fieldMatcher, customRules, options).result; },
    };
}
export const defaultMasker = createMasker();
export function maskSensitiveData(data, options) {
    return createMasker(options).mask(data);
}
export function maskSensitiveDataWithResult(data, options) {
    return createMasker(options).maskWithResult(data);
}
export function maskString(text, options) {
    return createMasker(options).maskString(text);
}
export const maskData = maskSensitiveData;
export function maskEmail(email) {
    const [name, domain] = email.split('@');
    if (!domain)
        return '***';
    const maskedName = name.length <= 2 ? '***' : name.slice(0, 2) + '***';
    return `${maskedName}@${domain}`;
}
export function maskPhone(phone) {
    if (phone.length <= 4)
        return '****';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}
export const PRESET_RULES = {
    strict: { recursive: true, maxDepth: 5, preserveField: true, replacement: '[HIDDEN]', customRules: [{ pattern: /.*/i, replacement: '[REDACTED]', recursive: false }] },
    lenient: { recursive: true, maxDepth: 10, preserveField: true, prefixLength: 2, suffixLength: 2 },
    payment: { recursive: true, preserveField: true, customRules: [{ pattern: /^(cardNumber|pan|creditCard|debitCard)$/i, prefixLength: 4, suffixLength: 4 }, { pattern: /^(cvv|cvc)$/i, replacement: '[CVV]' }, { pattern: /^(expiry|expDate)$/i, replacement: '[EXPIRY]' }] },
    log: { recursive: true, maxDepth: 8, preserveField: true, customRules: [{ pattern: /password/i, replacement: '[PWD]' }, { pattern: /token/i, prefixLength: 4, suffixLength: 4 }, { pattern: /api[_-]?key/i, prefixLength: 6, suffixLength: 4 }, { pattern: /secret/i, replacement: '[SECRET]' }] },
};
export function createPresetMasker(preset) {
    return createMasker(PRESET_RULES[preset]);
}
export const logMasker = createMasker(PRESET_RULES.log);
//# sourceMappingURL=masking.js.map