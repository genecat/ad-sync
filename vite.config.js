import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: true,
    strictPort: true,
    allowedHosts: [
      'c046-2603-800c-2a00-c0bf-a513-1070-60f7-b308.ngrok-free.app'
    ]
  },
  assetsInclude: ['**/*.html']
});


