/**
 * ESLint Configuration nach MOJO Coding Standards
 * Siehe: /root/projects/CODING_STANDARDS.md Section 1.3
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // Import
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'never',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-unresolved': 'off', // TypeScript handles this

    // General
    'no-console': ['warn', { allow: ['log', 'warn', 'error'] }], // Allow console.log for startup messages
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
  },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs'],
};

