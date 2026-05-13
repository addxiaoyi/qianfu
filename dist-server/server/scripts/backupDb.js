import fs from 'fs';
import path from 'path';
const cwd = process.cwd();
const src = path.join(cwd, 'dev.db');
const backupDir = path.join(cwd, 'backup');
const ts = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, '')
    .slice(0, 14);
const dest = path.join(backupDir, `dev_${ts}.db`);
if (!fs.existsSync(src)) {
    process.exit(0);
}
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}
fs.copyFileSync(src, dest);
process.stdout.write(`Backup created: ${dest}\n`);
//# sourceMappingURL=backupDb.js.map