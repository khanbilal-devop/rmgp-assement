import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // API_URL lives in .env.local (never committed). The dev server forwards /api to it,
  // so the browser only talks to localhost and the Lambda URL stays out of the page code.
  const { API_URL } = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
    server: {
      proxy: API_URL
        ? { '/api': { target: API_URL, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') } }
        : undefined,
    },
  }
})
