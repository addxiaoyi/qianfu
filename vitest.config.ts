/**
 * Vitest 配置（与 scripts/cleanup-project.config.cjs 中的 vitestTests 对应）。
 * 若启用清理里的「删除测试」，需同步删掉本仓库 tests/ 与根目录 setupTests.ts。
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const coverageScope = process.env.COVERAGE_SCOPE ?? 'critical';
const isCriticalCoverage = coverageScope === 'critical';

/**
 * Critical coverage scope (CI hard gate).
 *
 * 修改规则：
 * 1) 仅包含已纳入“质量门槛”的核心路径；
 * 2) 新增文件前先补对应单测并确认门槛稳定；
 * 3) 不要为临时放行而随意删减此清单。
 */
const CRITICAL_COVERAGE_INCLUDE = [
  'src/hooks/useBufferedFetch.ts',
  'src/hooks/usePaymentStatusPolling.ts',
  'src/components/ui/use-toast.tsx',
  'src/lib/api-utils.ts',
  'src/stores/serverStore.ts',
  'src/stores/userStore.ts',
] as const;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    /** 测试文件只从 tests/ 下收集；改路径时请同步调整清理配置 */
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: isCriticalCoverage ? [...CRITICAL_COVERAGE_INCLUDE] : ['src/**/*'],
      exclude: ['**/*.d.ts', '**/node_modules/**', 'tests/**'],
      thresholds: isCriticalCoverage
        ? {
            lines: 70,
            functions: 70,
            branches: 60,
            statements: 70,
          }
        : undefined,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@qianfu/shared': resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
});
