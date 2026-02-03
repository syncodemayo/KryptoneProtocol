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
  server: {
    proxy: {
      // ShadowPay SDK init() fetches assets/JSON from relative or same-origin URLs;
      // proxy so those requests get the real API instead of SPA HTML.
      '/shadowpay': {
        target: 'https://shadow.radr.fun',
        changeOrigin: true,
      },
    },
  },
})
