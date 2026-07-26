import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // docker compose 開發模式下，bind mount 的檔案變更需要輪詢才偵測得到
    watch: { usePolling: process.env.VITE_USE_POLLING === '1' },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      // 審核後台跟 /api 走同一個 api 服務，路徑不同而已。
      // 一定要帶結尾斜線：不然會連 SPA 的 /admin 頁面路由本身都攔截去打 api，
      // 而 api 沒有 GET /admin，變成 404
      '/admin/': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    // three.js 很大，單獨切一包讓瀏覽器快取
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
