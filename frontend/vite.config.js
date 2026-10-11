import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Entra app registration's SPA redirect URI is http://localhost:5173, so
// dev and preview must run on exactly that port.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
    },
    preview: {
        port: 5173,
        strictPort: true,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.js'],
    },
});
