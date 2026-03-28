import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    host: process.env.TAURI_DEV_HOST || false,
    port: 5173,
    strictPort: true
  },
  preview: {
    host: process.env.TAURI_DEV_HOST || false,
    port: 4173,
    strictPort: true
  },
  build: {
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13'
  }
});
