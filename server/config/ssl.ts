import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

interface SSLConfig {
  enabled: boolean;
  key?: Buffer;
  cert?: Buffer;
  ca?: Buffer;
}

export function loadSSLConfig(): SSLConfig {
  const sslEnabled = process.env.SSL_ENABLED === 'true';
  
  if (!sslEnabled) {
    return { enabled: false };
  }

  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/server.key');
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/server.crt');

  try {
    return {
      enabled: true,
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined
    };
  } catch (error) {
    logger.error('[SSL] Failed to load SSL certificates:', { error });
    return { enabled: false };
  }
}

export function createHTTPServer(app: any, sslConfig: SSLConfig) {
  if (!sslConfig.enabled) {
    const http = require('http');
    return http.createServer(app);
  }
  
  const https = require('https');
  return https.createServer({
    key: sslConfig.key,
    cert: sslConfig.cert,
    ca: sslConfig.ca,
    minVersion: 'TLSv1.2',
    ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
    honorCipherOrder: true
  }, app);
}
