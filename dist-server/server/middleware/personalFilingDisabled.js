import { sendError } from '../utils/response.js';
export const personalFilingDisabled = (_req, res) => sendError(res, '该功能在个人备案模式下不可用', 403, 'PERSONAL_FILING_DISABLED');
//# sourceMappingURL=personalFilingDisabled.js.map