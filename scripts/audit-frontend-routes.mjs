import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const srcDir = resolve(root, 'qianfu-liandeng/src');
const appSource = readFileSync(resolve(srcDir, 'App.tsx'), 'utf8');
const routePattern = /\bpath=["']([^"']+)["']/g;
const routes = [...appSource.matchAll(routePattern)].map((match) => match[1]);

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const file = join(dir, name);
  if (statSync(file).isDirectory()) return walk(file);
  return /\.(?:ts|tsx)$/.test(name) && !/\.test\.(?:ts|tsx)$/.test(name) ? [file] : [];
});

const matchesRoute = (target, route) => {
  const escaped = route
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    .replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${escaped}/?$`).test(target);
};

const targetPatterns = [
  /<(?:Link|Navigate)\b[^>]*?\bto=["'](\/[^"'#?]*)["']/g,
  /\bnavigate\(\s*["'](\/[^"'#?]*)["']/g,
  /<a\b[^>]*?\bhref=["'](\/[^"'#?]*)["']/g,
];

const findings = [];
for (const file of walk(srcDir)) {
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const pattern of targetPatterns) {
    for (const match of source.matchAll(pattern)) {
      const target = match[1] || '/';
      if (routes.some((route) => matchesRoute(target, route))) continue;
      const line = source.slice(0, match.index).split('\n').length;
      findings.push(`${relative(root, file).replaceAll('\\', '/')}:${line}\t${target}`);
    }
  }
}

for (const finding of findings) console.log(`unregistered-route\t${finding}`);
console.log(`FRONTEND_ROUTE_FINDINGS=${findings.length}`);
if (findings.length > 0) process.exitCode = 1;
