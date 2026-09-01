import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  define: { __LOCAL_REVIEW_SERVER__: JSON.stringify(mode === 'review') },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    ...(mode === 'review' ? {
      host: '127.0.0.1', port: 5182, strictPort: true,
      proxy: { '/review-api': { target: 'http://127.0.0.1:5183', rewrite: path => path.replace(/^\/review-api/, '/api') } },
    } : {}),
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
}));
