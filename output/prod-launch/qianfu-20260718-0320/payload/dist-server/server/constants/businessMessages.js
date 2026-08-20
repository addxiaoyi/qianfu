export const DEFAULT_BUSINESS_LOCALE = 'en-US';
export const BUSINESS_MESSAGE_CATALOG = {
    LIST_SUCCESS: {
        'zh-CN': '{{resource}}列表获取成功',
        'en-US': '{{resource}} list retrieved successfully',
    },
    DETAIL_SUCCESS: {
        'zh-CN': '{{resource}}详情获取成功',
        'en-US': '{{resource}} details retrieved successfully',
    },
    CREATE_SUCCESS: {
        'zh-CN': '{{resource}}创建成功',
        'en-US': '{{resource}} created successfully',
    },
    UPDATE_SUCCESS: {
        'zh-CN': '{{resource}}更新成功',
        'en-US': '{{resource}} updated successfully',
    },
    DELETE_SUCCESS: {
        'zh-CN': '{{resource}}删除成功',
        'en-US': '{{resource}} deleted successfully',
    },
    DELETE_HARD_SUCCESS: {
        'zh-CN': '{{resource}}永久删除成功',
        'en-US': '{{resource}} permanently deleted successfully',
    },
    BATCH_SUCCESS: {
        'zh-CN': '{{resource}}批量操作完成',
        'en-US': '{{resource}} batch operation completed',
    },
    EMPTY_LIST: {
        'zh-CN': '{{resource}}暂无数据',
        'en-US': 'No {{resource}} found',
    },
    SUCCESS: {
        'zh-CN': '操作成功',
        'en-US': 'Success',
    },
    NOT_FOUND: {
        'zh-CN': '{{resource}}不存在',
        'en-US': '{{resource}} not found',
    },
};
function normalizeResource(resource, locale) {
    const value = resource?.trim();
    if (value && value.length > 0) {
        return value;
    }
    return locale === 'en-US' ? 'data' : '数据';
}
export function getBusinessMessage(key, options = {}) {
    const locale = options.locale ?? DEFAULT_BUSINESS_LOCALE;
    const template = BUSINESS_MESSAGE_CATALOG[key]?.[locale] ?? BUSINESS_MESSAGE_CATALOG.SUCCESS[locale];
    const resource = normalizeResource(options.resource, locale);
    return template.replace(/\{\{resource\}\}/g, resource);
}
//# sourceMappingURL=businessMessages.js.map