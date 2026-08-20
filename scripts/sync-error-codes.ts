/**
 * 错误码自动同步脚本
 *
 * 功能：
 * 1. 从 packages/shared/src/errors/AppError.ts 提取 ErrorCode enum
 * 2. 从 server/utils/errors.ts 提取扩展的 ErrorCode
 * 3. 自动生成 server/constants/errorCodeCatalog.ts
 *
 * 使用方法：
 *   npx tsx scripts/sync-error-codes.ts
 *
 * 或在 package.json 添加：
 *   "sync:error-codes": "tsx scripts/sync-error-codes.ts"
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件所在目录（兼容 ESM 和 CJS）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SHARED_ERRORS_PATH = path.join(PROJECT_ROOT, 'packages/shared/src/errors/AppError.ts');
const SERVER_ERRORS_PATH = path.join(PROJECT_ROOT, 'server/utils/errors.ts');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'server/constants/errorCodeCatalog.ts');

// HTTP 状态码映射表
const DEFAULT_HTTP_STATUS_MAP: Record<string, number> = {
  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,

  // Business Errors
  VALIDATION_ERROR: 400,
  RESOURCE_ALREADY_EXISTS: 409,
  RESOURCE_NOT_FOUND: 404,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  RATE_LIMIT_EXCEEDED: 429,
  PERMISSION_DENIED: 403,
  PAYMENT_FAILED: 402,
  INSUFFICIENT_BALANCE: 402,

  // Auth Errors (2xxx)
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_SESSION_EXPIRED: 401,
  AUTH_2FA_REQUIRED: 401,
  AUTHENTICATION_FAILED: 401,

  // User Errors (3xxx)
  USER_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 409,
  USER_EMAIL_NOT_VERIFIED: 403,
  USER_ACCOUNT_LOCKED: 403,
  USER_ACCOUNT_DISABLED: 403,

  // Server Errors (4xxx)
  SERVER_NOT_FOUND: 404,
  SERVER_ALREADY_EXISTS: 409,
  SERVER_NAME_TAKEN: 409,
  SERVER_AT_CAPACITY: 503,

  // Payment Errors (5xxx)
  PAYMENT_INSUFFICIENT_FUNDS: 402,
  PAYMENT_SUBSCRIPTION_EXPIRED: 402,

  // AI Errors (6xxx)
  AI_GENERATION_FAILED: 503,
  AI_MODEL_UNAVAILABLE: 503,
  AI_RATE_LIMITED: 429,

  // Extended server errors (从 server/utils/errors.ts)
  LIMIT_EXCEEDED: 429,
  INSUFFICIENT_FUNDS: 402,
  INVALID_OPERATION: 400,
  INVALID_INPUT: 400,
  EMAIL_NOT_VERIFIED: 403,
  SESSION_EXPIRED: 401,
  RATE_LIMITED: 429,
};

// 默认错误描述
const DEFAULT_DESCRIPTIONS: Record<string, { description: string; handling: string }> = {
  // 通用错误
  BAD_REQUEST: { description: 'Request syntax is invalid.', handling: 'Check request path, method and body payload.' },
  UNAUTHORIZED: { description: 'Authentication is required or token is invalid.', handling: 'Refresh token or re-login before retrying.' },
  FORBIDDEN: { description: 'User does not have enough permissions.', handling: 'Request elevated role or required permission group.' },
  NOT_FOUND: { description: 'Requested resource does not exist.', handling: 'Verify resource ID/path before retrying.' },
  CONFLICT: { description: 'Request conflicts with current resource state.', handling: 'Resolve state conflict and retry.' },
  UNPROCESSABLE_ENTITY: { description: 'Business-level validation failed.', handling: 'Correct semantic field values and retry.' },
  TOO_MANY_REQUESTS: { description: 'Rate limit exceeded.', handling: 'Retry later with exponential backoff.' },
  INTERNAL_ERROR: { description: 'Unexpected server-side failure.', handling: 'Retry once and contact support with requestId if repeated.' },
  SERVICE_UNAVAILABLE: { description: 'Dependent service is temporarily unavailable.', handling: 'Retry later and monitor service status.' },
  GATEWAY_TIMEOUT: { description: 'Upstream service timed out.', handling: 'Retry with reduced load or narrower query scope.' },

  // 业务错误
  VALIDATION_ERROR: { description: 'Input validation failed.', handling: 'Inspect `error.details` and fix offending fields.' },
  RESOURCE_ALREADY_EXISTS: { description: 'Resource already exists.', handling: 'Use a unique identifier or update existing resource.' },
  RESOURCE_NOT_FOUND: { description: 'Business resource cannot be located.', handling: 'Verify business key and availability.' },
  RESOURCE_CONFLICT: { description: 'Resource state conflicts with operation.', handling: 'Refresh resource state and retry.' },
  INVALID_CREDENTIALS: { description: 'Credential verification failed.', handling: 'Check account/password or auth provider settings.' },
  TOKEN_EXPIRED: { description: 'Access token has expired.', handling: 'Refresh token or login again.' },
  TOKEN_INVALID: { description: 'Token is malformed or revoked.', handling: 'Use a valid token and avoid replaying stale credentials.' },
  RATE_LIMIT_EXCEEDED: { description: 'Business-level request quota exceeded.', handling: 'Throttle client requests and retry later.' },
  RATE_LIMITED: { description: 'Request is actively being throttled.', handling: 'Wait and retry with backoff.' },
  PERMISSION_DENIED: { description: 'Operation is blocked by permission rules.', handling: 'Request required role/permission before retrying.' },
  PAYMENT_FAILED: { description: 'Payment operation failed.', handling: 'Verify payment channel response and retry flow safely.' },
  INSUFFICIENT_BALANCE: { description: 'User balance is insufficient.', handling: 'Top up account balance and retry.' },
  INSUFFICIENT_FUNDS: { description: 'Account funds are insufficient.', handling: 'Add funds and retry transaction.' },
  PAYMENT_REQUIRED: { description: 'Payment is required before continuing.', handling: 'Complete payment workflow then retry.' },
  INVALID_PAYMENT_METHOD: { description: 'Payment method is invalid.', handling: 'Switch to a valid payment method.' },
  TRANSACTION_NOT_FOUND: { description: 'Transaction record cannot be found.', handling: 'Verify transaction ID with payment provider.' },

  // 扩展错误
  LIMIT_EXCEEDED: { description: 'Operation exceeds configured limit.', handling: 'Reduce request frequency or size.' },
  INVALID_OPERATION: { description: 'Operation is invalid in current state.', handling: 'Check workflow state before calling operation.' },
  INVALID_INPUT: { description: 'Input does not satisfy business rules.', handling: 'Correct business fields and retry.' },
  EMAIL_NOT_VERIFIED: { description: 'Email address has not been verified.', handling: 'Verify email address before proceeding.' },
  SESSION_EXPIRED: { description: 'Session has expired.', handling: 'Login again and retry operation.' },
  AUTHENTICATION_FAILED: { description: 'Authentication process failed.', handling: 'Check authentication config and credentials.' },

  // 数据库错误
  DATABASE_ERROR: { description: 'Database operation failed.', handling: 'Retry if transient; escalate if persistent.' },
  UNIQUE_CONSTRAINT_VIOLATION: { description: 'Unique key conflict in database.', handling: 'Use non-duplicated values.' },
  FOREIGN_KEY_CONSTRAINT_VIOLATION: { description: 'Referenced record does not exist.', handling: 'Create related resource first or fix relation key.' },

  // 文件错误
  FILE_UPLOAD_ERROR: { description: 'File upload failed.', handling: 'Check file content, size and upload params.' },
  FILE_NOT_FOUND: { description: 'Requested file does not exist.', handling: 'Verify file identifier and storage status.' },
  FILE_SIZE_EXCEEDED: { description: 'Uploaded file is too large.', handling: 'Reduce file size and retry.' },

  // 网络错误
  NETWORK_ERROR: { description: 'Network connectivity issue occurred.', handling: 'Retry when network is stable.' },
  TIMEOUT_ERROR: { description: 'Request timed out.', handling: 'Retry with lower payload or extended timeout strategy.' },

  // Auth 错误
  AUTH_INVALID_CREDENTIALS: { description: 'Authentication credentials are invalid.', handling: 'Verify username/password and try again.' },
  AUTH_TOKEN_EXPIRED: { description: 'Authentication token has expired.', handling: 'Refresh token or login again.' },
  AUTH_TOKEN_INVALID: { description: 'Authentication token is invalid.', handling: 'Request a new token.' },
  AUTH_SESSION_EXPIRED: { description: 'User session has expired.', handling: 'Login again to create new session.' },
  AUTH_2FA_REQUIRED: { description: 'Two-factor authentication is required.', handling: 'Complete 2FA verification.' },

  // User 错误
  USER_NOT_FOUND: { description: 'User account not found.', handling: 'Verify user ID or email address.' },
  USER_ALREADY_EXISTS: { description: 'User account already exists.', handling: 'Use different email or login with existing account.' },
  USER_EMAIL_NOT_VERIFIED: { description: 'User email has not been verified.', handling: 'Check inbox for verification email.' },
  USER_ACCOUNT_LOCKED: { description: 'User account is locked.', handling: 'Contact support to unlock account.' },
  USER_ACCOUNT_DISABLED: { description: 'User account is disabled.', handling: 'Contact support to enable account.' },

  // Server 错误
  SERVER_NOT_FOUND: { description: 'Game server not found.', handling: 'Verify server ID or name.' },
  SERVER_ALREADY_EXISTS: { description: 'Game server already exists.', handling: 'Use different server name.' },
  SERVER_NAME_TAKEN: { description: 'Server name is already taken.', handling: 'Choose a different server name.' },
  SERVER_AT_CAPACITY: { description: 'Server has reached maximum capacity.', handling: 'Try again later or select another server.' },

  // Payment 错误
  PAYMENT_INSUFFICIENT_FUNDS: { description: 'Payment amount exceeds available funds.', handling: 'Add more funds to payment method.' },
  PAYMENT_SUBSCRIPTION_EXPIRED: { description: 'Subscription has expired.', handling: 'Renew subscription to continue service.' },

  // AI 错误
  AI_GENERATION_FAILED: { description: 'AI content generation failed.', handling: 'Retry with different parameters.' },
  AI_MODEL_UNAVAILABLE: { description: 'AI model is temporarily unavailable.', handling: 'Retry later or use alternative model.' },
  AI_RATE_LIMITED: { description: 'AI service rate limit exceeded.', handling: 'Reduce request frequency.' },
};

/**
 * 从 TypeScript enum 提取错误码
 */
function extractErrorCodes(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const enumRegex = /enum\s+ErrorCode\s*\{([^}]+)\}/g;
  const codes: string[] = [];

  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumBody = match[1];
    const codeMatches = enumBody.matchAll(/^\s*(\w+)\s*=\s*['"](\w+)['"]/gm);
    for (const codeMatch of codeMatches) {
      codes.push(codeMatch[2]);
    }
  }

  return [...new Set(codes)];
}

/**
 * 从对象字面量提取错误码 (const ErrorCode = { ... })
 */
function extractErrorCodesFromConst(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const codes: string[] = [];

  // 匹配 const ErrorCode = { ...扩展的错误码 }
  const constRegex = /export\s+const\s+ErrorCode\s*=\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s;
  const match = content.match(constRegex);

  if (match) {
    const objBody = match[1];
    // 提取添加的错误码 (形如: KEY: 'KEY' as SharedErrorCode)
    const addCodes = objBody.matchAll(/(\w+):\s*['"](\w+)['"]\s*as\s*\w+/g);
    for (const codeMatch of addCodes) {
      codes.push(codeMatch[2]);
    }
  }

  return codes;
}

/**
 * 生成 errorCodeCatalog.ts 内容
 */
function generateCatalog(sharedCodes: string[], serverCodes: string[]): string {
  const allCodes = [...new Set([...sharedCodes, ...serverCodes])];
  allCodes.sort();

  // 生成 HTTP 状态码映射
  const httpStatusEntries = allCodes.map(code => {
    const status = DEFAULT_HTTP_STATUS_MAP[code] || 500;
    return `  ${code}: ${status}`;
  });

  // 生成错误码目录项
  const catalogEntries = allCodes.map(code => {
    const desc = DEFAULT_DESCRIPTIONS[code] || {
      description: `${code.replace(/_/g, ' ').toLowerCase()} error.`,
      handling: 'Review error details and correct the issue.',
    };
    return `  ${code}: item('${code}', '${desc.description}', '${desc.handling}')`;
  });

  return `/**
 * 错误码目录 - 自动生成
 *
 * 本文件由 scripts/sync-error-codes.ts 自动生成
 * 不要手动修改此文件，修改将会在下次同步时被覆盖
 *
 * 同步规则:
 * 1. 从 packages/shared/src/errors/AppError.ts 提取 ErrorCode enum
 * 2. 从 server/utils/errors.ts 提取扩展的 ErrorCode
 * 3. 运行: npm run sync:error-codes
 */

export const API_ERROR_CODE_HTTP_STATUS = {
${httpStatusEntries.join(',\n')},
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODE_HTTP_STATUS;

export interface ErrorCodeCatalogItem {
  code: ApiErrorCode;
  httpStatus: number;
  description: string;
  handling: string;
}

const item = (
  code: ApiErrorCode,
  description: string,
  handling: string,
): ErrorCodeCatalogItem => ({
  code,
  httpStatus: API_ERROR_CODE_HTTP_STATUS[code],
  description,
  handling,
});

export const ERROR_CODE_CATALOG: Record<ApiErrorCode, ErrorCodeCatalogItem> = {
${catalogEntries.join(',\n')},
};

export function getErrorCodeCatalogItem(code: ApiErrorCode): ErrorCodeCatalogItem {
  return ERROR_CODE_CATALOG[code];
}

/**
 * 获取所有错误码列表
 */
export function getAllErrorCodes(): ApiErrorCode[] {
  return Object.keys(ERROR_CODE_CATALOG) as ApiErrorCode[];
}

/**
 * 根据 HTTP 状态码获取对应的错误码列表
 */
export function getErrorCodesByHttpStatus(httpStatus: number): ApiErrorCode[] {
  return Object.entries(API_ERROR_CODE_HTTP_STATUS)
    .filter(([, status]) => status === httpStatus)
    .map(([code]) => code as ApiErrorCode);
}
`;
}

/**
 * 格式化代码（简单版本）
 */
function formatCode(code: string): string {
  return code
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +\n/g, '\n')
    .trim() + '\n';
}

/**
 * 主函数
 */
function main() {
  console.log('🔄 开始同步错误码...\n');

  // 1. 提取共享包的错误码
  console.log('📦 从 packages/shared/src/errors/AppError.ts 提取 ErrorCode...');
  const sharedCodes = extractErrorCodes(SHARED_ERRORS_PATH);
  console.log(`   找到 ${sharedCodes.length} 个错误码: ${sharedCodes.join(', ')}\n`);

  // 2. 提取服务器扩展的错误码
  console.log('🖥️  从 server/utils/errors.ts 提取扩展 ErrorCode...');
  const serverCodes = extractErrorCodesFromConst(SERVER_ERRORS_PATH);
  console.log(`   找到 ${serverCodes.length} 个扩展错误码: ${serverCodes.join(', ')}\n`);

  // 3. 生成目录
  console.log('📝 生成错误码目录...');
  const catalog = generateCatalog(sharedCodes, serverCodes);
  const formattedCatalog = formatCode(catalog);

  // 4. 写入文件
  console.log(`💾 写入 ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, formattedCatalog, 'utf-8');

  console.log('\n✅ 错误码同步完成!');
  console.log(`   总共 ${sharedCodes.length + serverCodes.length} 个错误码`);
  console.log(`   - 共享错误码: ${sharedCodes.length}`);
  console.log(`   - 扩展错误码: ${serverCodes.length}`);
}

main();
