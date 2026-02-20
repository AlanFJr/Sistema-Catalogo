import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: '127.0.0.1',
    strictPort: true,
    cors: false,
    proxy: {
      '/api': 'http://127.0.0.1:5176',
      '/uploads': 'http://127.0.0.1:5176'
    }
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          icons: ['lucide-react']
        }
      }
    }
  }
});
