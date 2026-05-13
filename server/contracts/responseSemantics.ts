import { type BusinessLocale, getBusinessMessage } from '../constants/businessMessages';

export type ResponseSemanticOperation =
  | 'list'
  | 'detail'
  | 'create'
  | 'update'
  | 'delete'
  | 'delete_hard'
  | 'batch'
  | 'empty';

export interface ResponseMessageOptions {
  resource?: string;
  message?: string;
  locale?: BusinessLocale;
}

const OPERATION_TO_MESSAGE_KEY = {
  list: 'LIST_SUCCESS',
  detail: 'DETAIL_SUCCESS',
  create: 'CREATE_SUCCESS',
  update: 'UPDATE_SUCCESS',
  delete: 'DELETE_SUCCESS',
  delete_hard: 'DELETE_HARD_SUCCESS',
  batch: 'BATCH_SUCCESS',
  empty: 'EMPTY_LIST',
} as const;

export function resolveResponseMessage(
  type: ResponseSemanticOperation,
  options: ResponseMessageOptions = {},
): string {
  if (options.message) {
    return options.message;
  }

  return getBusinessMessage(OPERATION_TO_MESSAGE_KEY[type], {
    locale: options.locale,
    resource: options.resource,
  });
}

export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
}

export function buildBatchSummary(results: Array<{ success: boolean }>): BatchSummary {
  const successful = results.filter((item) => item.success).length;
  return {
    total: results.length,
    successful,
    failed: results.length - successful,
  };
}
