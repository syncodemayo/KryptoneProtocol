import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Enable SPA fallback for client-side routing
  server: {
    // Dev server: redirect all requests to index.html
    historyApiFallback: true,
  },
  preview: {
    // Preview server: redirect all requests to index.html
    historyApiFallback: true,
  },
})
