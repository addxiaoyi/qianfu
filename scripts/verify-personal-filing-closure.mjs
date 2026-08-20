const baseUrl = (process.env.QIANFU_BASE_URL || 'https://mc-u.top').replace(/\/$/, '');

const paths = [
  '/api/payment',
  '/api/v1/payment',
  '/api/wallet',
  '/api/v1/wallet',
  '/api/promo',
  '/api/v1/promo',
  '/api/qianfu',
  '/api/v1/qianfu',
  '/api/marketplace',
  '/api/v1/marketplace',
  '/api/admin/payment-projects',
  '/api/v1/admin/payment-projects',
  '/api/payment/xpay-bridge',
  '/api/v1/payment/xpay-bridge',
  '/api/payment/personal-qr',
  '/api/v1/payment/personal-qr',
];

const checkPath = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${path}: non-JSON response`);
  }

  if (response.status !== 403) {
    throw new Error(`${path}: expected HTTP 403, received ${response.status}`);
  }
  if (body?.error?.code !== 'PERSONAL_FILING_DISABLED') {
    throw new Error(`${path}: expected PERSONAL_FILING_DISABLED, received ${body?.error?.code || 'missing code'}`);
  }

  return { path, status: response.status, code: body.error.code };
};

const results = await Promise.all(paths.map(checkPath));
console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
