import {
  MutationCache,
  QueryCache,
  QueryClient,
  type Mutation,
  type Query,
} from '@tanstack/react-query';
import { notifyError } from './error-notification';

type GlobalFeedbackMeta = {
  suppressGlobalError?: boolean;
};

type StatusError = {
  status?: unknown;
  response?: { status?: unknown };
};

function resolveStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as StatusError;
  const rawStatus = candidate.status ?? candidate.response?.status;
  return typeof rawStatus === 'number' && Number.isFinite(rawStatus) ? rawStatus : undefined;
}

function suppressesGlobalError(meta: unknown): boolean {
  return Boolean((meta as GlobalFeedbackMeta | undefined)?.suppressGlobalError);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;

  const status = resolveStatus(error);
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

function shouldNotifyQuery(query: Query<unknown, unknown, unknown, readonly unknown[]>): boolean {
  return !suppressesGlobalError(query.meta);
}

function shouldNotifyMutation(mutation: Mutation<unknown, unknown, unknown, unknown>): boolean {
  return !mutation.options.onError && !suppressesGlobalError(mutation.options.meta);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (shouldNotifyQuery(query)) {
        notifyError(error instanceof Error ? error : new Error(String(error)));
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (shouldNotifyMutation(mutation)) notifyError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
