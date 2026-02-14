import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tailwind from 'eslint-plugin-tailwindcss';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

/** @type {import('eslint').Linter.Config[]} */
const config = [
    {
        ignores: [
            'node_modules/**',
            'public/**',
            '.husky/**',
            '.idea/**',
            '.swc/**',
            'drizzle/**',
            '.next/**',
            'next.config.js',
            'postcss.config.js',
            'tailwind.config.js',
        ],
    },
    { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,
    eslintPluginUnicorn.configs['flat/recommended'],
    ...tailwind.configs['flat/recommended'],
    ...compat.config({
        extends: ['next'],
        settings: {
            next: {
                rootDir: '.',
            },
        },
    }),
    {
        rules: {
            'no-undef': 'warn', // Lowered severity
            'react/react-in-jsx-scope': 'off',
            'tailwindcss/no-custom-classname': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn', // Changed to warning
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'unicorn/prevent-abbreviations':"off",
            'unicorn/no-null': 'off',
            'unicorn/no-array-reduce': 'off',
            'unicorn/prefer-module': 'off',
            'unicorn/prefer-global-this': 'off',
            'unicorn/new-for-builtins': 'off',
            'unicorn/prefer-ternary': 'off',
            'unicorn/prefer-spread': 'off',
            'unicorn/switch-case-braces': 'off',
            'unicorn/no-array-callback-reference': 'off',
            'unicorn/no-array-for-each': 'off',
            'unicorn/prefer-string-replace-all': 'off',
            'unicorn/no-await-expression-member': 'off',
            'unicorn/consistent-function-scoping': 'off',
            'unicorn/prefer-string-raw': 'off',
            "unicorn/no-nested-ternary": "off",
            'unicorn/no-accessor-recursion': 'off',
            'no-console': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'import/no-cycle': ['error', { maxDepth: 1 }],
        },
    },
    {
        files: ['**/*.{jsx,tsx}'],
        rules: {
            'react/prop-types': 'off',
        },
    },
];

export default config;
