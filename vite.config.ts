import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png'],
            workbox: {
                // Don't cache-bust URLs that already have hashes (Vite assets)
                dontCacheBustURLsMatching: /\.[a-f0-9]{8}\./,
                // Skip waiting so the new SW activates immediately when user accepts
                skipWaiting: false, // We control this via the prompt
                clientsClaim: true,
                // Ensure navigation requests always get index.html even if the
                // new SW hasn't fully populated its cache yet (prevents black
                // screen on Android standalone PWA after update reload).
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/api/, /\.[a-z]+$/i],
            },
            manifest: {
                short_name: 'simpleTracker',
                name: 'simpleTracker',
                description: "A simple app to track your notes and tasks.",
                icons: [
                    {
                        src: 'favicon.ico',
                        sizes: '64x64 32x32 24x24 16x16',
                        type: 'image/x-icon',
                        purpose: 'any',
                    },
                    {
                        src: 'android-chrome-192x192.png',
                        type: 'image/png',
                        sizes: '192x192',
                        purpose: 'any',
                    },
                    {
                        src: 'android-chrome-512x512.png',
                        type: 'image/png',
                        sizes: '512x512',
                        purpose: 'any',
                    },
                    {
                        src: 'android-chrome-192x192.png',
                        type: 'image/png',
                        sizes: '192x192',
                        purpose: 'maskable',
                    },
                    {
                        src: 'android-chrome-512x512.png',
                        type: 'image/png',
                        sizes: '512x512',
                        purpose: 'maskable',
                    },
                ],
                start_url: '.',
                display: 'standalone',
                theme_color: '#d79a00',
                background_color: '#121212',
            },
        }),
    ],
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/test/setup.ts',
    },
});
