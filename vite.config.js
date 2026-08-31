import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/hearthmoor/' : '/',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: false,
  },
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
}))
