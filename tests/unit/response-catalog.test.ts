import { describe, expect, it } from 'vitest';
import { getBusinessMessage } from '../../server/constants/businessMessages';
import {
  API_ERROR_CODE_HTTP_STATUS,
  ERROR_CODE_CATALOG,
  type ApiErrorCode,
} from '../../server/constants/errorCodeCatalog';

describe('response catalogs', () => {
  it('business messages should support locale and resource placeholders', () => {
    expect(getBusinessMessage('CREATE_SUCCESS', { resource: 'Ticket', locale: 'en-US' })).toBe(
      'Ticket created successfully',
    );
    expect(getBusinessMessage('DELETE_SUCCESS', { resource: '工单', locale: 'zh-CN' })).toBe(
      '工单删除成功',
    );
  });

  it('error code catalog should contain all unique error codes and statuses', () => {
    const codes = Object.keys(API_ERROR_CODE_HTTP_STATUS) as ApiErrorCode[];
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length);
    expect(Object.keys(ERROR_CODE_CATALOG).length).toBe(codes.length);

    for (const code of codes) {
      expect(ERROR_CODE_CATALOG[code]).toBeDefined();
      expect(ERROR_CODE_CATALOG[code].httpStatus).toBe(API_ERROR_CODE_HTTP_STATUS[code]);
      expect(ERROR_CODE_CATALOG[code].code).toBe(code);
    }
  });
});
