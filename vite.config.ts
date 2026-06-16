/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

// Deployment base: "/" for the real domain and local dev; the Pages deploy
// sets BASE_PATH=/react-opendefence-docs/ (project URL) until DNS exists.
const base = process.env.BASE_PATH ?? "/";
const baseRe = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build stamp shown in the page footer. Date is the build time; commit is the
// short git SHA (falls back to "dev" outside a git checkout, e.g. CI tarballs).
const buildDate = new Date().toISOString().slice(0, 10);
let buildCommit = "dev";
try {
  buildCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // not a git checkout — keep the fallback
}

export default defineConfig({
  base,
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
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
        start_url: base,
        scope: base,
        theme_color: "#ff6b1a",
        background_color: "#1a1a1a",
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${base}icons/icon-512-maskable.png`,
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
          "release-docs/manifest.json",
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [
          new RegExp(`^${baseRe}(content|api-specs|release-docs|pagefind)/`),
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: new RegExp(`^${baseRe}(content/)?images/`),
            handler: "CacheFirst",
            options: {
              cacheName: "content-images",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: new RegExp(`^${baseRe}api-specs/`),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-specs" },
          },
          {
            urlPattern: new RegExp(`^${baseRe}release-docs/`),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "release-docs" },
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
  // helpcontent/ holds reference clones of other repos (own html entries,
  // uninstalled deps): keep Vite's dep scanner and watcher out of them.
  optimizeDeps: {
    entries: ["index.html"],
  },
  server: {
    watch: {
      ignored: ["**/helpcontent/**", "**/backups/**"],
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
