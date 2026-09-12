import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker only runs in production builds (the default) — in
      // dev, Vite's HMR already gives instant reloads, and a SW caching
      // dev-server assets would just fight with that.
      includeAssets: [
        "pwa/icon-master.svg",
        "pwa/favicon-32.png",
        "pwa/apple-touch-icon.png",
      ],
      manifest: {
        name: "Mood Music",
        short_name: "Mood Music",
        description: "Type your mood, get matching Spotify playlists.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FAF9F5",
        theme_color: "#C2603F",
        icons: [
          {
            src: "/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML/icons) for offline
        // loading; let /api/* pass straight through to the network
        // untouched — auth/session/search responses must never be cached.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dist",
  },
});
