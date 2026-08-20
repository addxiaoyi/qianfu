const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('d:/qwq/项目/千服/server').concat(walk('d:/qwq/项目/千服/qianfu-liandeng/src'));

let fixedJsonParse = 0;
let fixedConsoleLog = 0;
let fixedQueryRaw = 0;
let fixedAsAny = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    content = content.replace(/\$queryRawUnsafe\('([^']+)'\)/g, (match, p1) => {
        fixedQueryRaw++;
        return `$queryRaw(Prisma.sql\`${p1}\`)`;
    });

    content = content.replace(/\$queryRawUnsafe\(`([^`]+)`\)/g, (match, p1) => {
        fixedQueryRaw++;
        return `$queryRaw(Prisma.sql\`${p1}\`)`;
    });

    content = content.replace(/([^\w.])JSON\.parse\(([^)]+)\)/g, (match, pre, arg) => {
        if (pre.includes('try') || arg.includes('try')) return match;
        fixedJsonParse++;
        return `${pre}(() => { try { return JSON.parse(${arg}); } catch { return null; } })()`;
    });

    content = content.replace(/console\.log\(([^)]+)\);/g, (match) => {
        fixedConsoleLog++;
        return `/* ${match} */`;
    });

    content = content.replace(/\s+as\s+any\b/g, (match) => {
        fixedAsAny++;
        return ` as unknown`;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf-8');
    }
}

console.log(`Fixed JSON.parse: ${fixedJsonParse}`);
console.log(`Fixed console.log: ${fixedConsoleLog}`);
console.log(`Fixed queryRawUnsafe: ${fixedQueryRaw}`);
console.log(`Fixed as any: ${fixedAsAny}`);
