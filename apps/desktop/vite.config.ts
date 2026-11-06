/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  server: { port: 1420, strictPort: true },
  build: { target: 'es2023' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@locales': path.resolve(import.meta.dirname, './locales'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
