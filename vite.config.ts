import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
