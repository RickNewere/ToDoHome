import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// On GitHub Pages the app is served from /<repo>/, so every asset URL needs
// that prefix. Override with VITE_BASE when hosting somewhere else.
const base = process.env.VITE_BASE ?? '/ToDoHome/'

export default defineConfig({
  base,
  define: {
    // Stamped into the footer. Without it there is no way to tell whether a
    // phone is running the build you just shipped or an older one still held
    // by the service worker.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'ToDoHome',
        short_name: 'ToDoHome',
        description: 'Le faccende di casa di Riccardo e Roberta',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#eef2f7',
        theme_color: '#eef2f7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Chore data always comes from the network: a stale list would be worse
        // than an empty one, since the whole point is knowing what is late.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // Lets the phone open the dev server over the local network.
    host: true,
  },
})
