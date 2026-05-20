import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    nodePolyfills({
      // simple-peer requires global and process polyfills
      globals: {
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    proxy: {
      // Forward /api/* requests to the backend dev server
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

