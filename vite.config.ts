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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Bean Avenue Register",
        short_name: "Bean Register",
        description: "Bean Avenue point of sale",
        theme_color: "#2f3b2f",
        background_color: "#faf3e8",
        display: "standalone",
        start_url: "/pos",
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
