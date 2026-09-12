import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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
  plugins: [react(), tailwindcss()],
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
