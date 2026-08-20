import { describe, expect, it } from 'vitest';

import { parseQiuPayCreateResponse } from '../../server/controllers/paymentController';

describe('QiuPay create response parsing', () => {
  it('accepts a successful nested API payment response', () => {
    expect(parseQiuPayCreateResponse({
      code: 0,
      msg: 'success',
      data: {
        trade_no: 'upstream-123',
        qrcode: 'weixin://wxpay/bizpayurl?pr=test',
      },
    }, 200, 'https://pay.mzfpay.com/xpay/epay/mapi.php')).toEqual({
      paymentUrl: 'weixin://wxpay/bizpayurl?pr=test',
      paymentQrContent: 'weixin://wxpay/bizpayurl?pr=test',
      upstreamOrderId: 'upstream-123',
      qrImagePath: undefined,
    });
  });

  it('falls back to the signed submit page when the API omits a payment URL', () => {
    expect(parseQiuPayCreateResponse({
      code: 0,
      msg: 'success',
    }, 200, 'https://pay.mzfpay.com/xpay/epay/mapi.php', 'https://pay.mzfpay.com/xpay/epay/submit.php?pid=12082')).toMatchObject({
      paymentUrl: 'https://pay.mzfpay.com/xpay/epay/submit.php?pid=12082',
    });
  });

  it('uses a non-image code_url as the QR payment payload', () => {
    expect(parseQiuPayCreateResponse({
      code: 1,
      msg: 'success',
      data: {
        trade_no: 'upstream-456',
        payurl: 'https://pay.mzfpay.com/checkout/merchant-order',
        code_url: 'weixin://wxpay/bizpayurl?pr=direct-payment',
      },
    }, 200, 'https://pay.mzfpay.com/xpay/epay/mapi.php')).toEqual({
      paymentUrl: 'https://pay.mzfpay.com/checkout/merchant-order',
      paymentQrContent: 'weixin://wxpay/bizpayurl?pr=direct-payment',
      upstreamOrderId: 'upstream-456',
      qrImagePath: undefined,
    });
  });
});
