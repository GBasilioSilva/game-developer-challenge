import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['tests/**/*', 'node_modules/**'],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pixi')) {
              return 'pixi'
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react'
            }
            if (id.includes('@tanstack') || id.includes('axios') || id.includes('msw')) {
              return 'data'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
