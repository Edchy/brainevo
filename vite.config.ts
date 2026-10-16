import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The 3D stage (three.js + every procedural scene, ~1.6 MB raw / ~450 KB gzip) is one lazy chunk that loads while
    // the intro is already on screen (App.tsx lazy-imports it); the first-paint bundle is ~110 KB gzip.
    chunkSizeWarningLimit: 1800,
  },
})
