import { z } from 'zod';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

/**
 * Resolves all IP addresses for a hostname and checks if any are private
 */
export const isSafeHostname = async (hostname: string): Promise<boolean> => {
  if (!hostname || typeof hostname !== 'string') return false;
  
  // If it's already an IP, just check it
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    return !isPrivateIP(hostname);
  }

  try {
    const [ipv4, ipv6] = await Promise.all([
      resolve4(hostname).catch(() => [] as string[]),
      resolve6(hostname).catch(() => [] as string[])
    ]);

    const allIps = [...ipv4, ...ipv6];
    if (allIps.length === 0) return true; // No IPs found, might be invalid but not private

    return allIps.every(ip => !isPrivateIP(ip));
  } catch (error) {
    // If resolution fails, we assume it's not a private IP we can reach
    return true;
  }
};

export const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string()
    .min(12, { message: "Password must be at least 12 characters long" })
    .max(100, { message: "Password must be at most 100 characters long" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/\d/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, { message: "Password must contain at least one special character" }),
  username: z.string().min(2, { message: "Username must be at least 2 characters" }).max(50),
});

export const usernameAvailabilitySchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, { message: 'Username must be at least 2 characters' })
    .max(50, { message: 'Username too long' })
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, { message: "Token is required" }),
  email: z.string().email({ message: "Invalid email address" }),
});

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export const devAuthLoginSchema = z.object({
  username: z.string().trim().min(1, { message: 'Username is required' }).max(64, { message: 'Username too long' }),
  password: z.string().min(1, { message: 'Password is required' }).max(128, { message: 'Password too long' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export const resendVerificationSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Token is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  newPassword: z.string()
    .min(12, { message: "Password must be at least 12 characters long" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/\d/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, { message: "Password must contain at least one special character" }),
});

export const changePasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  oldPassword: z.string().min(1, { message: "Old password is required" }),
  newPassword: z.string()
    .min(12, { message: "Password must be at least 12 characters long" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/\d/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, { message: "Password must contain at least one special character" }),
});

export const uploadSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(100, "Filename too long").regex(/^[a-zA-Z0-9._-]+$/, "Invalid filename format").refine(val => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    return allowedExtensions.some(ext => val.toLowerCase().endsWith(ext));
  }, "Invalid file extension. Allowed: .png, .jpg, .jpeg, .gif, .webp").optional(),
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Invalid dataUrl format").max(7 * 1024 * 1024, "File too large (max 5MB after base64 encoding)").optional(),
  base64: z.string().min(1, "Base64 data is required").max(7 * 1024 * 1024, "File too large (max 5MB after base64 encoding)").refine(val => {
    // Basic base64 character validation
    return /^[a-zA-Z0-9+/]*={0,2}$/.test(val);
  }, "Invalid base64 data format").optional(),
  mime: z.string().regex(/^image\/(png|jpeg|gif|webp)$/, "Invalid MIME type").optional(),
}).refine(data => data.dataUrl || data.base64, {
  message: "Either dataUrl or base64 is required",
});

export const saveDraftSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  content: z.string().max(50000, "Content too long").optional(),
  version: z.number().int().nonnegative("Version must be a non-negative integer").optional(),
  seo_title: z.string().max(200, "SEO title too long").optional(),
  seo_description: z.string().max(500, "SEO description too long").optional(),
});

const jsonStringArray = z.string().refine((val) => {
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) && p.every((x) => typeof x === 'string');
  } catch {
    return false;
  }
}, "Must be a JSON array of strings").optional();

export const serverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
  name_en: z.string().max(50, "English name must be at most 50 characters").optional(),
  thumbnail: z.string().url("Invalid thumbnail URL").or(z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/, "Invalid thumbnail path")).optional().refine(val => {
    if (!val) return true;
    if (val.startsWith('/uploads/')) return true;
    return !validateUrl(val);
  }, { message: "Thumbnail URL points to a forbidden internal address" }),
  summary: z.string().max(200, "Summary must be at most 200 characters").optional(),
  summary_en: z.string().max(200, "English summary must be at most 200 characters").optional(),
  content_html: z.string().max(50000, "Content too long").optional(),
  ip: z.string().max(100, "IP too long").optional(),
  group_number: z.string().max(50, "Group number too long").optional(),
  tags: z.string().refine(val => {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Tags must be a valid JSON array string").optional(),
  link: z.string().url("Invalid link URL").max(500, "Link too long").optional().or(z.literal("")).refine(val => !val || !validateUrl(val), { message: "URL points to a forbidden internal address" }),
  activity: z.number().int().optional(),
  owner_id: z.number().int().optional(),
  platform: z.enum(['java', 'bedrock']).optional(),
  category: z.string().max(40, "Category too long").optional(),
  online_mode: z.boolean().optional(),
  supported_versions: jsonStringArray,
  network_env: jsonStringArray,
});

export const rollbackSchema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

export const checkStatusQuerySchema = z.object({
  host: z.string().min(1, 'Host is required').max(255).refine(val => !validateHost(val), { message: "Invalid or forbidden host" }),
  bedrock: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  serverId: z.string().regex(/^\d+$/).optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
});

export const serverHistoryQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

/** GET /servers/:id/versions/compare?old=&new= */
export const compareVersionsQuerySchema = z.object({
  old: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)),
  new: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)),
});

export const serverCommentBodySchema = z.object({
  body: z.string().min(1, 'Comment required').max(2000, 'Comment too long'),
});

export const playerHistoryQuerySchema = z.object({
  range: z.enum(['24h', '7d']).optional().default('24h'),
});

export const auditQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
  start: z.string().optional().transform(v => v ? Number(v) : undefined),
  end: z.string().optional().transform(v => v ? Number(v) : undefined),
  user: z.string().optional().transform(v => v ? Number(v) : undefined),
  action: z.string().optional(),
  target: z.string().optional(),
});

/**
 * Validate if the hostname is valid
 */
export const validateHost = (host: string): { message: string } | null => {
  if (!host || typeof host !== 'string' || host.trim() === '') {
    return { message: 'Hostname cannot be empty' };
  }

  // Simple regex validation, allows domain or IP address (IPv4/IPv6), optional port
  // IPv4: 1.2.3.4 or 1.2.3.4:25565
  // IPv6: [::1] or [::1]:25565 or ::1
  // Domain: example.com or example.com:25565
  const hostRegex = /^(\[([a-fA-F0-9:]+)\]|([a-zA-Z0-9.-]+))(:\d{1,5})?$/;
  if (!hostRegex.test(host)) {
    // If it doesn't match the combined regex, check if it's a bare IPv6 without brackets
    const bareIpv6Regex = /^[a-fA-F0-9:]+$/;
    if (!bareIpv6Regex.test(host) || host.split(':').length < 3) {
      return { message: 'Invalid hostname format' };
    }
  }

  let hostname = host;
  if (host.startsWith('[')) {
    hostname = host.split(']')[0].substring(1);
  } else if (host.includes(':')) {
    const parts = host.split(':');
    // If there's only one colon and it's followed by numbers, it's host:port
    if (parts.length === 2 && /^\d+$/.test(parts[1])) {
      hostname = parts[0];
    } else if (parts.length > 2) {
      // Multiple colons mean it's an IPv6 address (possibly with port if it was bracketed, but we handled that)
      // If it's not bracketed, the whole thing is the hostname
      hostname = host;
    }
  }
  if (isPrivateIP(hostname)) {
    return { message: 'Access to internal network addresses is forbidden' };
  }

  return null;
};

/**
 * Validate if a URL is safe (not pointing to a private address)
 */
export const validateUrl = (urlString: string): { message: string } | null => {
  if (!urlString || typeof urlString !== 'string') return null;
  
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    
    if (isPrivateIP(hostname)) {
      return { message: 'URL points to a forbidden internal address' };
    }
    
    return null;
  } catch (e) {
    return { message: 'Invalid URL format' };
  }
};

/**
 * Check if IP address is a private IP or local loopback address
 */
export const isPrivateIP = (ip: string): boolean => {
  if (!ip || typeof ip !== 'string') return true;

  // Standardize IPv6 and handle localhost
  const ipv6 = ip.toLowerCase().trim();
  
  if (ipv6 === 'localhost' || ipv6 === '127.0.0.1' || ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1') return true;
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
      if (intVal >= 0n && intVal <= 0xFFFFFFFFn) {
        const parts = [
          Number((intVal >> 24n) & 0xFFn),
          Number((intVal >> 16n) & 0xFFn),
          Number((intVal >> 8n) & 0xFFn),
          Number(intVal & 0xFFn)
        ];
        return isPrivateIP(parts.join('.'));
      }
    } catch (e) {}
  }

  // Check for IPv4
  const ipv4Parts = ipv6.split('.');
  if (ipv4Parts.length === 4) {
    try {
      const parts = ipv4Parts.map(part => {
        if (part.startsWith('0x')) return parseInt(part, 16);
        if (part.startsWith('0') && part.length > 1 && !part.includes('.')) return parseInt(part, 8);
        return parseInt(part, 10);
      });

      if (parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
        const [first, second] = parts;

        // 127.0.0.0/8 (Loopback)
        if (first === 127) return true;

        // 10.0.0.0/8 (Private)
        if (first === 10) return true;

        // 172.16.0.0/12 (Private)
        if (first === 172 && second >= 16 && second <= 31) return true;

        // 192.168.0.0/16 (Private)
        if (first === 192 && second === 168) return true;
        
        // 0.0.0.0/8 (Current network)
        if (first === 0) return true;
        
        // 169.254.0.0/16 (Link-local)
        if (first === 169 && second === 254) return true;

        return false;
      }
    } catch (e) {}
  }

  // Handle IPv6 (basic check for common private/local ranges)
  if (ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1') return true; // loopback
  if (ipv6.startsWith('fe80:')) return true; // link-local
  if (ipv6.startsWith('fc00:') || ipv6.startsWith('fd00:')) return true; // unique local
  if (ipv6 === '::' || ipv6 === '0:0:0:0:0:0:0:0') return true; // unspecified
  if (ipv6.startsWith('ff')) return true; // multicast

  return false;
};

export const auditQuerySchemaFull = z.object({
  target: z.string().optional(),
  limit: z.string().optional().transform(v => v ? Math.min(100, Math.max(1, Number(v))) : 50),
});

export const metricsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, Number(v) || 1)),
  size: z.string().optional().transform(v => Math.min(100, Math.max(1, Number(v) || 6))),
  sortBy: z.enum(['timestamp', 'visits', 'active', 'registered']).optional().default('timestamp'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  start: z.string().optional().transform(v => v ? Number(v) : undefined),
  end: z.string().optional().transform(v => v ? Number(v) : undefined),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid ID").transform(Number),
});

export const serverIdParamSchema = z.object({
  serverId: z.string().regex(/^\d+$/, "Invalid Server ID").transform(Number),
});

export const userIdParamSchema = z.object({
  userId: z.string().regex(/^\d+$/, "Invalid User ID").transform(Number),
});

export const serverCommentDeleteParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid ID").transform(Number),
  commentId: z.string().regex(/^\d+$/, "Invalid Comment ID").transform(Number),
});

export const reviewActionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_REVISION', 'PENDING']),
  notes: z.string().max(500, "Notes too long").optional(),
  score: z.number().min(0).max(100).optional(),
});

export const batchReviewSchema = z.object({
  serverIds: z.array(z.number().int().positive()),
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_REVISION']),
  feedback: z.string().max(500, "Feedback too long").optional(),
});

export const profileUpdateSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters").max(50, "Username too long").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens").optional(),
  display_name: z.string().max(50, "Display name too long").optional(),
  avatar_url: z.string().max(500, "Avatar URL too long").url("Invalid avatar URL").or(z.string().max(500, "Avatar path too long").regex(/^\/uploads\/[a-zA-Z0-9._-]+$/, "Invalid avatar path")).optional().refine(val => {
    if (!val) return true;
    if (val.startsWith('/uploads/')) return true;
    return !validateUrl(val);
  }, { message: "Avatar URL points to a forbidden internal address" }),
  preferences: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
  bio_html: z.string().max(10000, "Biography content too long").optional(),
});

/** 兼容历史 Prisma UUID 会话与 SuperTokens session handle */
export const sessionIdParamSchema = z.object({
  sessionId: z
    .string()
    .min(8, 'Invalid session ID format')
    .max(256, 'Invalid session ID format'),
});

export const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description too long"),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  paymentId: z.string().uuid("Invalid payment ID format").optional(),
});

export const ticketMessageSchema = z.object({
  content: z.string().min(1, "Message content is required").max(2000, "Message content too long"),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

export const paymentCreateSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  planId: z.string().min(1, "Plan ID is required").max(50, "Plan ID too long"),
  paymentMethod: z.enum(['wechat', 'alipay', 'balance']),
  currency: z.string().length(3, "Currency must be a 3-letter code").optional().default('CNY'),
});

export const manualPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const paymentStatusParamSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const paymentCancelParamSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const permissionHistoryQuerySchema = z.object({
  userId: z.string().regex(/^\d+$/, "Invalid User ID").transform(Number).optional(),
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});
export const xpayNotifySchema = z.object({
  type: z.string().min(1),
  money: z.string().min(1),
  mark: z.string().min(1),
  dt: z.string().min(1),
  sign: z.string().min(1),
});

export const payProNotifySchema = z.object({
  orderNo: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  payNum: z.string().min(1),
  sign: z.string().min(1),
});

const sortOrderQuerySchema = z.enum(['asc', 'desc']);
const parseQueryPage = (v?: string) => Math.max(1, parseInt(v || '1', 10) || 1);
const parseQueryLimit = (v?: string, fallback: number = 20) => Math.max(1, Math.min(100, parseInt(v || String(fallback), 10) || fallback));
const parseQueryDate = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);
const safeKeywordSchema = z
  .string()
  .max(80, "Search term too long")
  .optional()
  .refine(val => {
    if (!val) return true;
    // Prevent common ReDoS patterns (excessive wildcards or nesting)
    const suspiciousPatterns = [/.*\..*\..*\..*/, /.*\*.*\*.*\*/, /(.)\1{5,}/];
    return !suspiciousPatterns.some(pattern => pattern.test(val));
  }, "Invalid search pattern")
  .transform(v => v?.trim());

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 20)),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  tag: z.string().max(30, "Tag too long").optional(),
  bedrock: z.string().optional(),
  host: z.string().optional(),
  sortBy: z.enum(['activity', 'updated', 'created', 'players', 'name']).optional().default('activity'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  version: z.string().max(30, "Version too long").optional(),
  online: z.enum(['true', 'false']).optional(),
  status: z.enum(['online', 'offline', 'unknown']).optional(),
  category: z.string().max(40, "Category too long").optional(),
  platform: z.enum(['java', 'bedrock', 'all']).optional(),
  online_mode: z.enum(['all', 'yes', 'no']).optional(),
  fuzzy: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  sortOrder: data.sortOrder || data.order || 'desc',
  fuzzy: data.fuzzy ?? true,
}));

export const setupSoleAdminSchema = z.object({
  targetUsername: z.string().min(2, "Username too long").max(50).optional(),
  targetEmail: z.string().email("Invalid email address").optional(),
}).refine(data => data.targetUsername || data.targetEmail, {
  message: "Either targetUsername or targetEmail is required",
});

export const userRoleUpdateSchema = z.object({
  role: z.string().min(1, "Role is required"),
});

export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
  level: z.string().optional(),
  sortBy: z.enum(['created_at', 'action']).optional().default('created_at'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 50)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  sortOrder: data.sortOrder || data.order || 'desc',
}));

export const assignPermissionGroupSchema = z.object({
  group: z.string().min(1, "Group is required"),
});

export const batchAssignPermissionGroupSchema = z.object({
  userIds: z.array(z.number().int().positive()),
  group: z.string().min(1, "Group is required"),
});

export const updateModerationSettingSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.any().optional(),
  isSecret: z.boolean().optional(),
  description: z.string().max(500, "Description too long").optional(),
});

export const moderationLogQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  contentType: z.string().optional(),
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const reviewModerationLogSchema = z.object({
  status: z.enum(['PASSED', 'REJECTED']),
  reason: z.string().max(500, "Reason too long").optional(),
});

export const updateModerationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().min(0).max(1).optional(),
  imageThreshold: z.number().min(0).max(1).optional(),
  apiKey: z.string().optional(),
});

export const preferencesUpdateSchema = z.object({
  theme: z.enum(['system', 'light', 'dark', 'minimal', 'classic', 'monitoring', 'random']).optional(),
  language: z.enum(['zh', 'en']).optional(),
  emailNotifications: z.boolean().optional(),
});

export const staticDataQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const port5555LogQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
  search: z.string().max(50, "Search term too long").optional(),
  action: z.string().optional(),
  method: z.string().max(10).optional(),
  status: z.enum(['success', 'failed']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const port5555ExportSchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  search: z.string().max(50, "Search term too long").optional(),
  method: z.string().max(10).optional(),
  status: z.enum(['success', 'failed']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const port5555CleanupSchema = z.object({
  retentionDays: z.number().int().min(1, "Retention days must be at least 1").max(3650, "Retention days too long").optional().default(90),
});

export const port5555DetailsSchema = z.object({
  ip_address: z.string().optional().default('Unknown'),
  userAgent: z.string().optional().default('Unknown'),
  path: z.string().optional().default('Unknown'),
  method: z.string().optional().default('Unknown'),
  sessionId: z.string().optional(),
});

export const myServersQuerySchema = z.object({
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 20)),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  reviewStatus: z.enum(['all', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION']).optional().default('all'),
  sortBy: z.enum(['updated_at', 'created_at', 'activity', 'name']).optional().default('updated_at'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  fuzzy: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  sortOrder: data.sortOrder || data.order || 'desc',
  fuzzy: data.fuzzy ?? true,
}));

export const cmsPaginationQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const cmsGetPageQuerySchema = z.object({
  lock: z.string().optional().transform(v => v === '1'),
});

export const paymentQuerySchema = z.object({
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 20)),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  fuzzy: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  status: z.string().optional(),
  planId: z.string().optional(),
  userId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  sortBy: z.enum(['created_at', 'updated_at', 'amount', 'status']).optional().default('created_at'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  fuzzy: data.fuzzy ?? true,
  sortOrder: data.sortOrder || data.order || 'desc',
}));

export const userQuerySchema = z.object({
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 20)),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  role: z.string().optional(),
  status: z.enum(['all', 'verified', 'unverified']).optional().default('all'),
  sortBy: z.enum(['created_at', 'last_login_at', 'username', 'email']).optional().default('created_at'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  fuzzy: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  sortOrder: data.sortOrder || data.order || 'desc',
  fuzzy: data.fuzzy ?? true,
}));

export const bioVersionQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const ticketQuerySchema = z.object({
  page: z.string().optional().transform(v => parseQueryPage(v)),
  limit: z.string().optional().transform(v => parseQueryLimit(v, 20)),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  search: safeKeywordSchema,
  q: safeKeywordSchema,
  fuzzy: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
  sortBy: z.enum(['updated_at', 'created_at', 'priority', 'status']).optional().default('updated_at'),
  sortOrder: sortOrderQuerySchema.optional(),
  order: sortOrderQuerySchema.optional(),
  startDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid startDate").transform(v => parseQueryDate(v)),
  endDate: z.string().optional().refine(v => !v || !Number.isNaN(Date.parse(v)), "Invalid endDate").transform(v => parseQueryDate(v)),
}).transform(data => ({
  ...data,
  search: data.search || data.q,
  fuzzy: data.fuzzy ?? true,
  sortOrder: data.sortOrder || data.order || 'desc',
}));

const aiClientMetaSchema = z.object({
  routeHash: z.string().max(2048).optional(),
  isMobileViewport: z.boolean().optional(),
  viewport: z.string().max(32).optional(),
  /** 本页逐项激活的能力点（1–58），与注册表 server/config/aiIntegrationRegistry 对应 */
  activeIntegrationIds: z.array(z.number().int().min(1).max(58)).max(64).optional(),
  /** 页内细粒度说明（Tab/步骤等），供模型结合路由理解 */
  sceneNote: z.string().max(500).optional(),
  /** 前端展示用摘要，权限以服务端会话为准 */
  profileHint: z
    .object({
      level: z.number().int().min(0).max(100).optional(),
      role: z.string().max(64).optional(),
    })
    .optional(),
});

export const aiChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
  context: z.string().max(1200, "Context too long").optional(),
  language: z.enum(['zh', 'en']).optional().default('zh'),
  clientMeta: aiClientMetaSchema.optional(),
});

export const visitSchema = z.object({
  page: z.string().max(255, "Page name too long").optional(),
});

export const visitStatsQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.min(30, Math.max(1, parseInt(v || '7') || 7))),
});

export const auditStatsQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.min(90, Math.max(1, parseInt(v || '30') || 30))),
});

export const auditTimeSeriesQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.min(90, Math.max(1, parseInt(v || '7') || 7))),
  interval: z.enum(['hour', 'day']).optional().default('day'),
});

export const auditReportSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['csv', 'json']).optional().default('csv'),
  reportType: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional().default('custom'),
});

export const port5555BatchOperationsSchema = z.object({
  operations: z.array(z.object({
    type: z.string().min(1, "Operation type is required"),
    payload: z.any().optional(),
    priority: z.number().int().optional(),
  })).min(1, "At least one operation is required"),
});

export const port5555ErrorTestQuerySchema = z.object({
  type: z.enum(['permission', 'rate_limit', 'session']).optional(),
});

export const auditCleanupSchema = z.object({
  days: z.string().optional().transform(v => Math.max(1, parseInt(v || '365') || 365)),
});

export const auditExportSchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const reviewQuerySchema = z.object({
  sortBy: z.enum(['created_at', 'updated_at', 'name']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const walletRechargeSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  targetUserId: z.number().int().positive("Invalid target user ID").optional(),
});

export const walletTransactionQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});

export const walletRedeemSchema = z.object({
  code: z.string().trim().min(1, '兑换码不能为空').max(64, '兑换码过长'),
});

export const adminCreateRedeemCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, '兑换码至少 4 位')
    .max(64, '兑换码过长')
    .regex(/^[A-Za-z0-9_-]+$/, '兑换码仅支持字母数字下划线和中划线'),
  amount: z.number().positive('金额必须大于 0').max(1000000, '金额过大'),
  maxUses: z.number().int('次数必须为整数').min(1, '次数至少为 1').max(1000000, '次数过大').optional().default(1),
  nonWithdrawable: z.boolean().optional().default(true),
  expiresAt: z.string().datetime().optional(),
  note: z.string().max(200, '备注过长').optional(),
});

export const adminGenerateRedeemCodeSchema = z.object({
  amount: z.number().positive('金额必须大于 0').max(1000000, '金额过大'),
  maxUses: z.number().int('次数必须为整数').min(1, '次数至少为 1').max(1000000, '次数过大').optional().default(1),
  nonWithdrawable: z.boolean().optional().default(true),
  expiresAt: z.string().datetime().optional(),
  note: z.string().max(200, '备注过长').optional(),
  length: z.number().int('长度必须为整数').min(6).max(24).optional().default(10),
});

export const adminRedeemCodeListQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.max(1, Math.min(100, parseInt(v || '20') || 20))),
});
export const mcStatusDirectTestSchema = z.object({
  host: z.string().min(1, "Host is required"),
  type: z.enum(['java', 'bedrock']).optional().default('java'),
});

export const paymentStatsQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.max(1, Math.min(90, parseInt(v || '7') || 7))),
});

export const port5555StatsQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.max(1, Math.min(30, parseInt(v || '7') || 7))),
});
