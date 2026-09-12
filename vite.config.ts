import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Public path the app is served from.
 *
 * Vercel serves it at the domain root, so the default is `/`. A GitHub Pages
 * project site serves it at `/<repo>/`, and the Pages workflow sets
 * `BASE_PATH` accordingly. Anything referencing an asset by absolute path must
 * go through `import.meta.env.BASE_URL` for this to hold.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    /**
     * The PWA half of spec section 7.
     *
     * The models are the reason this exists. `public/models/` is about 23 MB
     * per device — a 13 MB embedder, a 4 MB classifier and one of MediaPipe's
     * two 6 MB WASM builds — and GitHub Pages serves with a short `max-age`,
     * so without a service worker a user pays that again on a later visit.
     *
     * They are cached at **runtime**, not precached: putting 23 MB into the
     * precache manifest would make installing the service worker download
     * everything before the app could be used at all, including the embedder a
     * one-cat household deliberately skips. Cached on first use instead, and
     * kept: a model file never changes without its name changing.
     */
    VitePWA({
      registerType: 'autoUpdate',
      // The engine cannot run under `vite dev` anyway (module workers and
      // MediaPipe), so a service worker there would only add confusion.
      devOptions: { enabled: false },
      includeAssets: ['icon.svg', 'favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Meowlogue',
        short_name: 'Meowlogue',
        description:
          'Meowlogue aprende el vocabulario de tus gatos. Todo el audio se queda en tu teléfono.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf7f2',
        theme_color: '#faf7f2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Keep the models out of the precache manifest; they are handled by
        // the runtime rule below.
        globIgnores: ['**/models/**'],
        navigateFallback: `${base}index.html`,
        // The worklet and worker are requested by URL from JavaScript rather
        // than by a navigation, so they need to be in the precache to work
        // offline at all.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'meowlogue-models',
              // Two models, two WASM builds and their JS glue, plus headroom.
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
              // A range request would otherwise be cached as a partial body.
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // `earshot` is consumed as TypeScript source straight from GitHub, so it
    // must not be pre-bundled: Vite has to compile its worker and worklet
    // entry points itself. See docs/decisions/0001-earshot-integration-seam.md.
    exclude: ['earshot'],
  },
  worker: {
    /**
     * Classic, not ES module: MediaPipe loads its WASM glue with
     * `importScripts`, which a module worker does not support, and its
     * fallback wants a `document` a worker does not have. Required from
     * earshot 0.4.0 onwards.
     *
     * This setting is global in Vite, so any worker Meowlogue adds of its own
     * — the nightly aggregation worker in spec section 7 — has to be IIFE too.
     */
    format: 'iife',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    /**
     * Never inline earshot's AudioWorklet processor.
     *
     * It is small enough that Vite would turn it into a `data:` URL, and
     * `audioWorklet.addModule()` does not reliably accept one — earshot's own
     * README flags this and recommends emitting it as a real asset when the
     * target browsers are uncertain. Meowlogue targets phones, iOS Safari
     * included, so it always gets a real URL. Everything else keeps Vite's
     * default behaviour.
     */
    assetsInlineLimit: (filePath: string) =>
      filePath.includes('capture-worklet') ? false : undefined,
  },
});
