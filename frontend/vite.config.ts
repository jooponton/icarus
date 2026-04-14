/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/image": path.resolve(__dirname, "./src/shims/next-image.tsx"),
      "next/link": path.resolve(__dirname, "./src/shims/next-link.tsx"),
    },
  },
  optimizeDeps: {
    include: [
      "@pascal-app/core",
      "@pascal-app/viewer",
      "@pascal-app/editor",
      "howler",
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_ASSETS_CDN_URL": JSON.stringify("/pascal"),
    "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify("/"),
    "process.env.NEXT_PUBLIC_VERCEL_ENV": JSON.stringify("development"),
    "process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_VERCEL_URL": JSON.stringify(""),
    "process.env.PORT": JSON.stringify("5173"),
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
