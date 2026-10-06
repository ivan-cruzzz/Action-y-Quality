import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Offline single-file build: one self-contained HTML file that runs from a
 * local disk with zero network. inlineDynamicImports merges the async chunks
 * (Capacitor plugins) into the single bundle so file:// module loading works.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "./",
  build: {
    outDir: "dist-offline",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
