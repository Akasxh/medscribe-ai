import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8000',
      },
      '/rx': {
        target: 'http://localhost:8000',
      },
    },
  },
})
