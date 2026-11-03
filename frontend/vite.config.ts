import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/fleet': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/predict': 'http://127.0.0.1:8000',
      '/explain': 'http://127.0.0.1:8000',
      '/incidents': 'http://127.0.0.1:8000',
      '/profile': 'http://127.0.0.1:8000',
      '/evaluation': 'http://127.0.0.1:8000',
      '/samples': 'http://127.0.0.1:8000',
      '/replay': 'http://127.0.0.1:8000',
      '/readings': 'http://127.0.0.1:8000',
    },
  },
})
