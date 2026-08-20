import { AppError, ErrorCode } from '../utils/errors';

export const isCommercialFeaturesEnabled = (): boolean => process.env.PERSONAL_FILING_MODE !== 'true';

export const assertCommercialFeatureEnabled = (feature = '商业功能'): void => {
  if (!isCommercialFeaturesEnabled()) {
    throw new AppError(`${feature}在个人备案模式下不可用`, 403, ErrorCode.FORBIDDEN);
  }
};
