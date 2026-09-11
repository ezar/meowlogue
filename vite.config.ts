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
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
