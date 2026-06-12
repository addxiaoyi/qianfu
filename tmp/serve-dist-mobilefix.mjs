import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'qianfu-liandeng', 'dist-mobilefix');
const host = '127.0.0.1';
const port = 4173;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const readFile = async (pathname) => {
  const candidate = path.resolve(root, `.${pathname}`);
  if (!candidate.startsWith(root)) {
    return null;
  }

  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) {
      return readFile(path.posix.join(pathname, 'index.html'));
    }
    return candidate;
  } catch {
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const pathname = safeDecode(url.pathname);
  const resolved = await readFile(pathname === '/' ? '/index.html' : pathname);
  const filePath = resolved || path.join(root, 'index.html');
  const ext = path.extname(filePath).toLowerCase();

  try {
    const body = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', mimeTypes.get(ext) || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Failed to serve ${filePath}: ${error?.message || error}`);
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`);
});
