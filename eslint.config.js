import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'mcp-server/src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
