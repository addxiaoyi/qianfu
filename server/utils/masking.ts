/**
 * Centralized data masking and sanitization utilities
 */

export const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'email', 'phone', 'mobile', 
  'last_ip', 'login_count', 'internal_notes', 'risk_score',
  'verification_token', 'email_cipher', 'supabase_id', 'salt', 'secret_key',
  'password_hash', 'token_expiry', 'signature', 'internal_id', 'secret_token',
  'reset_token', 'reset_token_expiry',
  'authorization', 'cookie', 'key', 'review_notes', 'permissions', 'user_ip'
];

/**
 * Mask an email address (e.g., jo***n@example.com)
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `*@${domain}`;
  return `${user.substring(0, 2)}***${user.substring(user.length - 1)}@${domain}`;
};

/**
 * Mask a phone number (e.g., 138****5678)
 */
export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 7) return phone;
  // Handle 11-digit Chinese phone numbers specifically, or generic format
  if (/^\d{11}$/.test(phone)) {
    return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  }
  return `${phone.substring(0, 3)}****${phone.substring(phone.length - 4)}`;
};

/**
 * Generic masking for sensitive data
 */
export const maskData = (data: any, depth = 0): any => {
  if (data === null || data === undefined || depth > 5) return data;

  if (data instanceof Date) {
    return data.toISOString();
  }
  
  if (typeof data === 'string') {
    // Check if it's an email
    if (data.includes('@') && data.includes('.') && data.length > 5) {
      return maskEmail(data);
    }
    // Check if it's a phone
    if (/^\d{7,15}$/.test(data)) {
      return maskPhone(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const masked: any = {};
    for (const key in data) {
      if (Object.hasOwn(data, key)) {
        const lowerKey = key.toLowerCase();
        const value = data[key];

        if (lowerKey === 'email_verified' || lowerKey === 'emailverified') {
          masked[key] = Boolean(value);
          continue;
        }
        
        // Check if key is sensitive
        if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
          // Special cases
          if (lowerKey === 'signature') {
            masked[key] = value; // Allow signature for integrity checks
          } else if (lowerKey.includes('email')) {
            masked[key] = typeof value === 'string' ? maskEmail(value) : '***MASKED***';
          } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
            masked[key] = typeof value === 'string' ? maskPhone(value) : '***MASKED***';
          } else {
            masked[key] = '***MASKED***';
          }
        } else {
          masked[key] = maskData(value, depth + 1);
        }
      }
    }
    return masked;
  }

  return data;
};
