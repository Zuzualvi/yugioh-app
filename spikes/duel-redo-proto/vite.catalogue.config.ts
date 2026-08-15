import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A SECOND, SEPARATE build so the prototype's own pipeline is untouched: the file
// the CEO downloads to review the duel screen must not change because a catalogue
// page was added beside it. Same IIFE + inline-everything constraints, because this
// page is opened from file:// too.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-catalogue",
    assetsDir: "assets",
    target: "es2019",
    rollupOptions: {
      input: "catalogue.html",
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
});
