#!/usr/bin/env node

import https from 'node:https';
import tls from 'node:tls';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function sanitize(value) {
  if (value == null) return '';
  return String(value).replace(/\r?\n+/g, ' ').trim();
}

function printField(key, value) {
  process.stdout.write(`${key}=${sanitize(value)}\n`);
}

function extractTagAttribute(body, tagName, matchers, attributeName) {
  const tags = body.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
  for (const tag of tags) {
    if (!matchers.every((matcher) => matcher.test(tag))) {
      continue;
    }
    const attributeMatch = tag.match(new RegExp(`${attributeName}=["']([^"']+)["']`, 'i'));
    if (attributeMatch) {
      return attributeMatch[1];
    }
  }
  return '';
}

function probeTls(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const certificate = socket.getPeerCertificate(true) || {};
        resolve({
          authorized: socket.authorized,
          authorizationError: socket.authorizationError || '',
          certCn: certificate.subject?.CN || '',
          certSan: certificate.subjectaltname || '',
        });
        socket.end();
      }
    );

    socket.setTimeout(12000, () => {
      socket.destroy(new Error('tls timeout'));
    });
    socket.on('error', reject);
  });
}

function probeHtml(host) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      servername: host,
    });

    const request = https.get(
      `https://${host}/`,
      {
        agent,
        timeout: 12000,
        headers: {
          'user-agent': 'qianfu-domain-probe/1.0',
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (body.length < 16384) {
            body += chunk.slice(0, 16384 - body.length);
          }
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            body,
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('http timeout'));
    });
    request.on('error', reject);
  });
}

function computeTlsStatus(tlsInfo, expectHost) {
  if (tlsInfo.authorized) {
    return 'ok';
  }

  const authError = tlsInfo.authorizationError || '';
  const certCn = tlsInfo.certCn || '';
  const certSan = tlsInfo.certSan || '';
  const hostMismatch =
    authError.includes('ALTNAME') ||
    authError.includes('HOSTNAME') ||
    authError.includes('wrong host') ||
    (expectHost && certCn && certCn !== expectHost && !certSan.includes(expectHost));

  if (hostMismatch) {
    return 'wrong_principal';
  }
  if (authError) {
    return 'cert_error';
  }
  return 'fail';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = args.host || '';
  const expectHost = args['expect-host'] || host;
  const mainSiteHost = args['main-site-host'] || '';

  if (!host) {
    throw new Error('Missing required --host argument');
  }

  const tlsInfo = await probeTls(host);
  const htmlInfo = await probeHtml(host);
  const canonicalUrl = extractTagAttribute(
    htmlInfo.body,
    'link',
    [/rel=["']canonical["']/i],
    'href'
  );
  const ogUrl = extractTagAttribute(
    htmlInfo.body,
    'meta',
    [/property=["']og:url["']/i],
    'content'
  );
  const looksLikeMainSite = Boolean(
    mainSiteHost &&
      ([canonicalUrl, ogUrl].some((value) => value.includes(mainSiteHost)) ||
        htmlInfo.body.includes(`https://${mainSiteHost}/`))
  );
  const rootMarkerMatch = htmlInfo.body.includes('qianfu-pay-gateway');

  printField('host', host);
  printField('tls_status', computeTlsStatus(tlsInfo, expectHost));
  printField('tls_authorization_error', tlsInfo.authorizationError);
  printField('cert_cn', tlsInfo.certCn);
  printField('cert_san', tlsInfo.certSan);
  printField('html_status', htmlInfo.statusCode);
  printField('canonical_url', canonicalUrl);
  printField('og_url', ogUrl);
  printField('looks_like_main_site', looksLikeMainSite ? 'true' : 'false');
  printField('root_marker_match', rootMarkerMatch ? 'true' : 'false');
}

main().catch((error) => {
  printField('probe_error', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
