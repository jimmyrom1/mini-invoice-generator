/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, /api se redirige a Flask para evitar problemas de CORS.
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:5000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
