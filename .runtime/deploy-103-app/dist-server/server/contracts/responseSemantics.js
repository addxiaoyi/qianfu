import { getBusinessMessage } from '../constants/businessMessages.js';
const OPERATION_TO_MESSAGE_KEY = {
    list: 'LIST_SUCCESS',
    detail: 'DETAIL_SUCCESS',
    create: 'CREATE_SUCCESS',
    update: 'UPDATE_SUCCESS',
    delete: 'DELETE_SUCCESS',
    delete_hard: 'DELETE_HARD_SUCCESS',
    batch: 'BATCH_SUCCESS',
    empty: 'EMPTY_LIST',
};
export function resolveResponseMessage(type, options = {}) {
    if (options.message) {
        return options.message;
    }
    return getBusinessMessage(OPERATION_TO_MESSAGE_KEY[type], {
        locale: options.locale,
        resource: options.resource,
    });
}
export function buildBatchSummary(results) {
    const successful = results.filter((item) => item.success).length;
    return {
        total: results.length,
        successful,
        failed: results.length - successful,
    };
}
//# sourceMappingURL=responseSemantics.js.map