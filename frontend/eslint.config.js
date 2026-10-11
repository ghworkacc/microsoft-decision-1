import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import importPlugin from '@njax/eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
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
            globals: {...globals.browser, ...globals.node},
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            indent: [
                'error',
                4,
                {
                    SwitchCase: 1,
                    FunctionDeclaration: {'parameters': 'first'},
                    FunctionExpression: {'parameters': 'first'},
                    CallExpression: {'arguments': 'first'},
                    // JSX indentation is handled by react/jsx-indent*
                    ignoredNodes: ['JSXElement', 'JSXElement *', 'JSXFragment', 'JSXFragment *'],
                }
            ],
            'react/jsx-indent': ['error', 4],
            'react/jsx-indent-props': ['error', 4],
            'react/prop-types': 'off',
            quotes: [
                'error',
                'single'
            ],
            semi: [
                'error',
                'always'
            ],
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
        extends: ['json/recommended']
    },
]);
