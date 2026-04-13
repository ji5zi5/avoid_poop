/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  test: {
    exclude: ["src/**/*.js"],
  },
});
