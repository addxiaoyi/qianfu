import { Response } from 'express';
import { type BusinessLocale } from '../constants/businessMessages';
export interface PaginatedResponse<T> {
    success: true;
    message: string;
    data: T[];
    requestId?: string;
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    timestamp: string;
}
export type DeleteMode = 'soft' | 'hard';
export interface ResourceMessageOptions {
    resource?: string;
    message?: string;
    locale?: BusinessLocale;
}
export interface SendBatchResultItem<T = unknown> {
    id?: number | string;
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
/**
 * Standard Success Response
 */
export declare const sendSuccess: <T>(res: Response, data: T, message?: string, statusCode?: number, meta?: Record<string, unknown>) => Response<any, Record<string, any>>;
/**
 * Standard Error Response
 */
export declare const sendError: (res: Response, message?: string, statusCode?: number, errorCode?: string, details?: any) => Response<any, Record<string, any>>;
/**
 * Standard Paginated Response
 */
export declare const sendPaginated: <T>(res: Response, data: T[], total: number, page: number, limit: number, message?: string, statusCode?: number) => Response<any, Record<string, any>>;
export declare const sendListResponse: <T>(res: Response, data: T[], total: number, page: number, limit: number, options?: ResourceMessageOptions & {
    statusCode?: number;
}) => Response<any, Record<string, any>>;
export declare const sendDetailResponse: <T>(res: Response, data: T, options?: ResourceMessageOptions & {
    statusCode?: number;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const sendCreatedResponse: <T>(res: Response, data: T, options?: ResourceMessageOptions & {
    statusCode?: number;
    location?: string;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const sendUpdatedResponse: <T>(res: Response, data: T, options?: ResourceMessageOptions & {
    statusCode?: number;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const sendDeletedResponse: (res: Response, options?: ResourceMessageOptions & {
    statusCode?: number;
    mode?: DeleteMode;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const sendBatchResponse: <T>(res: Response, results: Array<SendBatchResultItem<T>>, options?: ResourceMessageOptions & {
    statusCode?: number;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const sendEmptyResponse: <T>(res: Response, data: T, options?: ResourceMessageOptions & {
    statusCode?: number;
    meta?: Record<string, unknown>;
}) => Response<any, Record<string, any>>;
export declare const maskEmail: (email: string) => string;
export declare const maskPhone: (phone: string) => string;
export declare const toSafeUser: (user: any, options?: {
    mask?: boolean;
    isAdmin?: boolean;
}) => {
    level: number;
    xp_total: number;
    xp_into_level: number;
    xp_for_next_level: number;
    level_progress: number;
    level_is_max: boolean;
    level_granted_permissions: string[];
    can_publish: boolean;
} | {
    can_publish: boolean;
} | null;
//# sourceMappingURL=response.d.ts.map