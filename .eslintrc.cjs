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
    },
  ],
};
