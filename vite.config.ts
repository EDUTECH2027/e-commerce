import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle everything up front (including what the lazy admin chunk imports). Without this, Vite can
  // discover dependencies late, re-optimise mid-session and end up with two React copies ("Invalid hook call").
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'] },
  server: {
    proxy: { '/api': api, '/uploads': api },
  },
})
