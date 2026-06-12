/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "OpenDefence Docs",
        short_name: "OD Docs",
        description: "Documentation for Deploy App and the OpenDefence stack",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#ff6b1a",
        background_color: "#1a1a1a",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,svg,woff2}",
          "content/**/*.json",
          "pagefind/**/*",
          "api-specs/manifest.json",
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/(content|api-specs|pagefind)\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^\/(content\/)?images\//,
            handler: "CacheFirst",
            options: {
              cacheName: "content-images",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^\/api-specs\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-specs" },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@config": path.resolve(__dirname, "config"),
    },
  },
  build: {
    rollupOptions: {
      // The pagefind bundle is generated into public/ at build time and
      // loaded at runtime — it is not part of the module graph.
      external: [/^\/pagefind\//],
    },
  },
  test: {
    environment: "happy-dom",
    include: [
      "src/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
      "shared/**/*.test.ts",
    ],
  },
});
