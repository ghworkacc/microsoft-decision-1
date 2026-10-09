import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import importPlugin from '@njax/eslint-plugin-import';
import { defineConfig } from 'eslint/config';

const isVsCode = process.env.ELECTRON_NO_ASAR === '1';

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: {
            js,
            import: importPlugin,
        },
        extends: ['js/recommended'],
        languageOptions: {
            globals: {...globals.browser, ...globals.node},
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
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
                    CallExpression: {'arguments': 'first'}
                }
            ],
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
