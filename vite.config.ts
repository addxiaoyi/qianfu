import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:3000'

const vendorChunks: Record<string, readonly string[]> = {
  'vendor-react': ['react', 'react-dom', 'scheduler'],
}

const resolveVendorChunk = (id: string): string | undefined => {
  const normalizedId = id.replace(/\\/g, '/')
  if (!normalizedId.includes('/node_modules/')) return undefined

  for (const [chunkName, packages] of Object.entries(vendorChunks)) {
    const matchesPackage = packages.some((packageName) =>
      normalizedId.includes(`/node_modules/${packageName}/`),
    )
    if (matchesPackage) return chunkName
  }

  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 构建产物分析 (可选，生产构建时移除)
    // visualizer({
    //   filename: 'dist/stats.html',
    //   open: true,
    //   gzipSize: true,
    // }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Workspace dependencies such as @gsap/react are hoisted to the repository
    // root. Force every package to share this app's React hook dispatcher.
    dedupe: ['react', 'react-dom'],
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
    target: 'es2015',
    chunkSizeWarningLimit: 1200,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用源码映射用于调试
    sourcemap: false,
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        // 移除控制台日志
        drop_console: true,
        drop_debugger: true,
        // 移除所有 console.*
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        // 常用压缩优化
        passes: 2,
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      format: {
        comments: false,
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
        // 优化资源文件命名规则
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || ''
          if (/\.(png|jpe?g|svg|gif|webp|ico)$/.test(info)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/\.(woff|woff2?|eot|ttf|otf)$/.test(info)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          if (/\.css$/.test(info)) {
            return `assets/css/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // 资源内联阈值
    assetsInlineLimit: 4096, // 4KB 以下的资源内联为 base64
    // 清理产物目录
    emptyOutDir: true,
  },
  // 依赖优化配置
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'framer-motion',
      'lucide-react',
      '@tanstack/react-query',
    ],
  },
})
