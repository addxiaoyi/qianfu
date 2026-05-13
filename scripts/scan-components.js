import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPRECATED_FILES = [
  'components/ServerCard.tsx',
  'components/SkeletonComponents.tsx',
  // 'components/ui/minecraft-switch.tsx' // Uncomment to enforce strict switch usage
];

// Thresholds
const MAX_COMPONENT_SIZE_KB = 50; // Alert if a component file is too large

function getFileSizeInKB(filename) {
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes / 1024;
}

function scanDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? scanDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function scan() {
  console.log('🔍 Starting Component Scan...');
  let errors = 0;
  let warnings = 0;
  
  // 1. Check for deprecated files
  DEPRECATED_FILES.forEach(file => {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      console.error(`❌ [ERROR] Found deprecated file that should be removed: ${file}`);
      errors++;
    }
  });

  // 2. Dependency Check
  try {
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = Object.keys(packageJson.dependencies || {});
      
      if (deps.includes('vditor') && deps.includes('tinymce')) {
          console.warn('⚠️ [WARN] Multiple rich text editors detected (vditor + tinymce). Consider unifying.');
          warnings++;
      }
      
      if ((deps.includes('styled-components') || deps.includes('@emotion/react')) && deps.includes('tailwindcss')) {
          console.warn('⚠️ [WARN] Mixed styling approaches detected (CSS-in-JS + Tailwind). Recommended: Standardize on Tailwind.');
          warnings++;
      }
  } catch (e) {
      console.error('Failed to parse package.json', e);
  }

  // 3. Large Component Check
  const componentsDir = path.resolve(process.cwd(), 'components');
  if (fs.existsSync(componentsDir)) {
      scanDir(componentsDir, (filePath) => {
          if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
              const size = getFileSizeInKB(filePath);
              if (size > MAX_COMPONENT_SIZE_KB) {
                  console.warn(`⚠️ [WARN] Large component detected: ${path.relative(process.cwd(), filePath)} (${size.toFixed(2)} KB). Consider splitting.`);
                  warnings++;
              }
          }
      });
  }

  console.log('\n--- Scan Summary ---');
  console.log(`Errors: ${errors}`);
  console.log(`Warnings: ${warnings}`);

  if (errors > 0) {
    console.error('❌ Scan failed. Please fix critical errors.');
    process.exit(1);
  } else {
    console.log('✅ Scan passed.');
  }
}

scan();
