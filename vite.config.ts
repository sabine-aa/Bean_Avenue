import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Turns the register into an installable app that loads with no internet:
    // the built app shell is precached, and SPA routes fall back to index.html.
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,jpg,jpeg,webp,woff,woff2}"],
        // Shop product photos are many and load on demand — keep them out of the
        // precache so the service worker install stays small.
        globIgnores: ["**/photos/shop/**", "**/photos/doughnuts/**"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/photos/shop/") || url.pathname.startsWith("/photos/doughnuts/"),
            handler: "CacheFirst",
            options: { cacheName: "product-photos", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      // DEFAULT manifest = the public CUSTOMER app. Installing from the website
      // (/, /menu, /shop…) installs "Bean Avenue" and opens at home. The POS has
      // its own manifest (public/pos.webmanifest) swapped in on the /pos route.
      manifest: {
        id: "/",
        name: "Bean Avenue",
        short_name: "Bean Avenue",
        description: "Order coffee, food, sweets & shop products from Bean Avenue.",
        theme_color: "#2f3b2f",
        background_color: "#faf3e8",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/bean.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/bean.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // listen on the local network so phones/tablets can connect
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
