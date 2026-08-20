import { AppError, ErrorCode } from '../utils/errors.js';
export const isCommercialFeaturesEnabled = () => process.env.PERSONAL_FILING_MODE !== 'true';
export const assertCommercialFeatureEnabled = (feature = '商业功能') => {
    if (!isCommercialFeaturesEnabled()) {
        throw new AppError(`${feature}在个人备案模式下不可用`, 403, ErrorCode.FORBIDDEN);
    }
};
//# sourceMappingURL=commercialFeatures.js.map