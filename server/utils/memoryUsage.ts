import v8 from 'node:v8';

const PERCENT_MAX = 100;

export const calculateHeapUsagePercent = (heapUsed: number, heapLimit = v8.getHeapStatistics().heap_size_limit): number => {
  if (!Number.isFinite(heapUsed) || !Number.isFinite(heapLimit) || heapLimit <= 0) return 0;
  return Math.min(PERCENT_MAX, Math.max(0, Math.round((heapUsed / heapLimit) * PERCENT_MAX)));
};
