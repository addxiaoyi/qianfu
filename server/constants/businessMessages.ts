export type BusinessLocale = 'zh-CN' | 'en-US';

export type BusinessMessageKey =
  | 'LIST_SUCCESS'
  | 'DETAIL_SUCCESS'
  | 'CREATE_SUCCESS'
  | 'UPDATE_SUCCESS'
  | 'DELETE_SUCCESS'
  | 'DELETE_HARD_SUCCESS'
  | 'BATCH_SUCCESS'
  | 'EMPTY_LIST'
  | 'SUCCESS'
  | 'NOT_FOUND';

interface BusinessMessageTemplate {
  'zh-CN': string;
  'en-US': string;
}

export const DEFAULT_BUSINESS_LOCALE: BusinessLocale = 'en-US';

export const BUSINESS_MESSAGE_CATALOG: Record<BusinessMessageKey, BusinessMessageTemplate> = {
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

interface ResolveBusinessMessageOptions {
  locale?: BusinessLocale;
  resource?: string;
}

function normalizeResource(resource: string | undefined, locale: BusinessLocale): string {
  const value = resource?.trim();
  if (value && value.length > 0) {
    return value;
  }
  return locale === 'en-US' ? 'data' : '数据';
}

export function getBusinessMessage(
  key: BusinessMessageKey,
  options: ResolveBusinessMessageOptions = {},
): string {
  const locale = options.locale ?? DEFAULT_BUSINESS_LOCALE;
  const template = BUSINESS_MESSAGE_CATALOG[key]?.[locale] ?? BUSINESS_MESSAGE_CATALOG.SUCCESS[locale];
  const resource = normalizeResource(options.resource, locale);
  return template.replace(/\{\{resource\}\}/g, resource);
}
