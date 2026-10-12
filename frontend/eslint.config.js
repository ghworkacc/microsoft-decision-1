import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import importPlugin from '@njax/eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

const isVsCode = process.env.ELECTRON_NO_ASAR === '1';

export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{js,mjs,cjs,jsx}'],
        plugins: {
            js,
            import: importPlugin,
        },
        extends: [
            'js/recommended',
            react.configs.flat.recommended,
            react.configs.flat['jsx-runtime'],
            reactHooks.configs.flat.recommended,
        ],
        settings: {
            react: { version: 'detect' },
        },
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            'react/prop-types': 'off',
            curly: 'off',
            'padded-blocks': 'off',
            'array-bracket-spacing': 'off',
            'key-spacing': 'off',
            'no-multi-spaces': 'off',
            'react/react-in-jsx-scope': 'off',
            'no-multiple-empty-lines': isVsCode ? 'off' : 'error',
            'no-debugger': isVsCode ? 'off' : 'error',
            'import/no-commonjs': 'error',
        },
    },
    {
        files: ['**/*.json'],
        ignores: ['package-lock.json'],
        plugins: { json },
        language: 'json/json',
        extends: ['json/recommended'],
    },
    {
        // Keep this last so Prettier disables conflicting formatting rules.
        ...prettierRecommended,
        files: ['**/*.{js,mjs,cjs,jsx}'],
    },
]);
