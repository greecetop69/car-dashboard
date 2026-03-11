import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_BACKEND_URL = "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: DEV_BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
});
