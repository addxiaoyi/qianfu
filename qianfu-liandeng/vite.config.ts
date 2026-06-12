import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    ...(process.platform === 'win32'
      ? {
          // Rolldown's React refresh wrapper is unstable on this Windows workspace.
          // Disabling HMR keeps the dev server serving modules normally so the UI can render.
          hmr: false,
        }
      : {}),
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/v1': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
            if (id.includes('@tanstack') || id.includes('zustand')) return 'vendor-state';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('lowlight') || id.includes('highlight.js')) return 'vendor-editor';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          }
        },
      },
    },
  },
})
