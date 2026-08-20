/* eslint-env node */
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: [
    'dist',
    'dist-server',
    'node_modules',
    'prisma/generated',
    'coverage',
    'xpay-3.1_YTM7H',
    'server/uidlll',
    'public/tinymce',
    'tmp',
    '*.cjs',
    'scripts/xpay-mock-server.cjs',
  ],
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty': 'off',
    'no-useless-escape': 'off',
    'no-constant-condition': 'off',
    'no-control-regex': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'prefer-const': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/ban-types': 'off',
  },
  overrides: [
    {
      files: ['server/**/*.ts', 'scripts/**/*.ts'],
      env: { node: true, browser: false },
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'setupTests.ts', 'vitest.config.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      // Optional modules not mounted by the production router. Keep their rules narrow
      // until they are promoted into a reachable product path.
      files: [
        'qianfu-liandeng/src/forms/**/*.ts',
        'qianfu-liandeng/src/forms/**/*.tsx',
        'qianfu-liandeng/src/hooks/useDruid.ts',
        'qianfu-liandeng/src/pages/admin/DruidDashboard.tsx',
        'qianfu-liandeng/src/hooks/usePermission.tsx',
        'qianfu-liandeng/src/hooks/useResourcePreload.ts',
        'qianfu-liandeng/src/utils/resource-preloader.ts',
        'qianfu-liandeng/src/hooks/useSSE.ts',
        'qianfu-liandeng/src/hooks/useSkeletonCache.tsx',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      files: [
        'qianfu-liandeng/src/hooks/useRoutePrefetch.tsx',
        'qianfu-liandeng/src/components/ui/Skeleton.tsx',
        'qianfu-liandeng/src/pages/CompliancePolicy.tsx',
      ],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};
