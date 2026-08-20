const INTERNAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
];

export function isSafeHostname(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }

  const normalized = hostname.toLowerCase().trim();

  if (INTERNAL_HOSTNAMES.has(normalized)) {
    return false;
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  return true;
}
