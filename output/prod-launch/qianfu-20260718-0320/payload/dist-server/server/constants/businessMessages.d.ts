export type BusinessLocale = 'zh-CN' | 'en-US';
export type BusinessMessageKey = 'LIST_SUCCESS' | 'DETAIL_SUCCESS' | 'CREATE_SUCCESS' | 'UPDATE_SUCCESS' | 'DELETE_SUCCESS' | 'DELETE_HARD_SUCCESS' | 'BATCH_SUCCESS' | 'EMPTY_LIST' | 'SUCCESS' | 'NOT_FOUND';
interface BusinessMessageTemplate {
    'zh-CN': string;
    'en-US': string;
}
export declare const DEFAULT_BUSINESS_LOCALE: BusinessLocale;
export declare const BUSINESS_MESSAGE_CATALOG: Record<BusinessMessageKey, BusinessMessageTemplate>;
interface ResolveBusinessMessageOptions {
    locale?: BusinessLocale;
    resource?: string;
}
export declare function getBusinessMessage(key: BusinessMessageKey, options?: ResolveBusinessMessageOptions): string;
export {};
//# sourceMappingURL=businessMessages.d.ts.map