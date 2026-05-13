import fs from 'fs';
import path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const log = (msg: string, color: keyof typeof COLORS = 'reset') => {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
};

const checkFileExists = (filePath: string, description: string) => {
  if (fs.existsSync(filePath)) {
    log(`[PASS] ${description} exists: ${filePath}`, 'green');
    return true;
  } else {
    log(`[FAIL] ${description} missing: ${filePath}`, 'red');
    return false;
  }
};

const checkFileContent = (filePath: string, pattern: RegExp, description: string) => {
  if (!fs.existsSync(filePath)) {
    log(`[FAIL] Cannot check content, file missing: ${filePath}`, 'red');
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  if (pattern.test(content)) {
    log(`[PASS] ${description} detected in ${path.basename(filePath)}`, 'green');
    return true;
  } else {
    log(`[FAIL] ${description} NOT detected in ${path.basename(filePath)}`, 'red');
    return false;
  }
};

const runChecks = async () => {
  log('Starting Security Checks...', 'cyan');
  let passed = 0;
  let total = 0;

  // 1. Check robots.txt
  total++;
  if (checkFileExists(path.join(process.cwd(), 'public', 'robots.txt'), 'robots.txt')) {
    total++;
    if (checkFileContent(path.join(process.cwd(), 'public', 'robots.txt'), /Disallow: \/api\//, 'API blocking rules')) {
      passed++;
    }
    total++;
    if (checkFileContent(path.join(process.cwd(), 'public', 'robots.txt'), /GPTBot/, 'AI Bot blocking')) {
      passed++;
    }
    passed++;
  }

  // 2. Check Vite Config for console drop
  total++;
  if (checkFileContent(path.join(process.cwd(), 'vite.config.ts'), /drop:\s*isProduction\s*\?\s*\['console'/, 'Console log dropping')) {
    passed++;
  }

  // 3. Check Server App for security headers registration
  total++;
  if (
    checkFileContent(
      path.join(process.cwd(), 'server', 'app.ts'),
      /(registerSecurityHeaders\(app\)|app\.use\(helmet\()/,
      'Security headers middleware'
    )
  ) {
    passed++;
  }

  // 4. Check Server App for Anti-Crawler
  total++;
  if (checkFileContent(path.join(process.cwd(), 'server', 'app.ts'), /app\.use\(antiCrawler\)/, 'Anti-Crawler middleware')) {
    passed++;
  }

  // 5. Check Env for Production Security
  // This is a static check of the .env.example or just a reminder
  log('---------------------------------------------------');
  log('Runtime checks (ensure server is running on localhost:4123 or similar):', 'yellow');
  
  // Optional: Check live headers if server is running
  // Skipping for now as this is a static check script mostly
  
  log('---------------------------------------------------');
  log(`Security Check Complete: ${passed}/${total} passed.`, passed === total ? 'green' : 'yellow');
};

runChecks().catch(console.error);
