import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pagesTarget = process.env.JUCHESS_PAGES_TARGET
const isRootPagesBuild = pagesTarget === 'root'
const isLegacyPagesBuild = pagesTarget === 'web'

// https://vite.dev/config/
export default defineConfig({
  base: isLegacyPagesBuild || isRootPagesBuild ? '/web/' : '/',
  build: {
    outDir: isRootPagesBuild ? '../../.pages-root' : isLegacyPagesBuild ? '../../docs/web' : 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    copyPublicDir: !isRootPagesBuild,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              name: 'appwrite-vendor',
              test: /node_modules[\\/]appwrite[\\/]/,
              priority: 20,
            },
            {
              name: 'icons-vendor',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [react()],
})
