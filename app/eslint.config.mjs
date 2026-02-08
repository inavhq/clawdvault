import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript recommended rules
      ...tsPlugin.configs.recommended.rules,
      
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Unused variables - ERROR level
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      
      // Unused expressions - ERROR level
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      
      // Additional rules to catch potentially unused code
      'no-unused-private-class-members': 'error',
      'no-useless-assignment': 'error',
      
      // Disable base ESLint rules in favor of TypeScript equivalents
      'no-unused-vars': 'off',
      'no-unused-expressions': 'off',
    },
  },
  {
    // Config files can have unused vars (like config objects)
    files: ['*.config.{js,ts}', '*.config.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
