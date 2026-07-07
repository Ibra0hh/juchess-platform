import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/juchess-platform/web/' : '/',
  build: {
    outDir: process.env.GITHUB_PAGES === 'true' ? '../../docs/web' : 'dist',
    emptyOutDir: true,
  },
  plugins: [react()],
})
