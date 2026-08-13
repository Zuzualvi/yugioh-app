import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the built bundle works when opened straight from file://
// (there is no preview deployment for proto/* branches — see the ZUH-81 writeup).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    target: "es2019",
    // IIFE + a single chunk so `inline.mjs` can fold everything into one HTML file
    // that opens straight from file:// (ES modules are CORS-blocked on file://).
    rollupOptions: { output: { format: "iife", inlineDynamicImports: true } },
  },
});
