import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
		root: '.',
    build: {
        lib: {
            entry: resolve(__dirname, 'lib/main.js'),
            name: 'Poc Decide Something',
            fileName: 'poc-decide-something-lib',
        },
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled into your library
            // external: ['vue'],
            external: [],
            output: {
                // Provide global variables to use in the UMD build for externalized deps
                globals: {
                    // vue: 'Vue',
                },
            },
        },
    },
});
