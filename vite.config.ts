import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: ".",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
