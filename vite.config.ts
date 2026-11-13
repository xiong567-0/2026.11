import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    proxy: {
      // 开发时把 /api 转发给本地 Hono 服务，避免跨域
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'server/**/*.spec.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
