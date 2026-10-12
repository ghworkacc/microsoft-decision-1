import js from '@eslint/js';
import globals from 'globals';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['node_modules']),
    {
        files: ['**/*.js'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: {
            globals: { ...globals.node },
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
    },
    {
        // Keep this last so Prettier disables conflicting formatting rules.
        ...prettierRecommended,
        files: ['**/*.js'],
    },
]);
