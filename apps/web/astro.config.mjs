import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// WorldBid 3D — Astro + React islands.
// globe.gl loads via CDN script tag in index.astro head (NOT npm) because the
// Vite-bundled import crashes with "Cannot read properties of undefined
// (reading 'filter')". The globe mounts in a plain <script> in Globe.astro.
export default defineConfig({
  integrations: [react()],
  server: {
    port: 4321,
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      target: 'es2022',
    },
  },
});