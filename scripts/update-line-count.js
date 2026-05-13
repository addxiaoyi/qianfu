import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TARGET_FILE = path.resolve(process.cwd(), 'components/Footer.tsx');

function getLineCount() {
  try {
    // 使用 PowerShell 获取行数 (兼容 Windows)
    const command = "(Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.css,*.json,*.js,*.md | Where-Object { $_.FullName -notmatch 'node_modules|dist|\\.git|\\.next' } | Get-Content | Measure-Object -Line).Lines";
    const output = execSync(`powershell -NoProfile -Command "${command}"`, { encoding: 'utf-8' }).trim();
    const count = parseInt(output);
    return isNaN(count) ? null : count;
  } catch (error) {
    console.error('Failed to get line count:', error);
    return null;
  }
}

function updateFooter(lineCount) {
  if (!fs.existsSync(TARGET_FILE)) {
    console.error('Footer.tsx not found');
    return;
  }

  let content = fs.readFileSync(TARGET_FILE, 'utf-8');
  const updatedContent = content.replace(/const lineCount = \d+;/, `const lineCount = ${lineCount};`);
  
  if (content !== updatedContent) {
    fs.writeFileSync(TARGET_FILE, updatedContent);
    console.log(`[LineCount] Updated Footer.tsx with ${lineCount} lines.`);
  } else {
    console.log('[LineCount] Line count unchanged.');
  }
}

const count = getLineCount();
if (count) {
  updateFooter(count);
}
