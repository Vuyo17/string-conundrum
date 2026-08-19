import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase and React are needed on every screen (auth gates the
        // whole app), so per-screen lazy-loading can't split them out —
        // but they change far less often than app code, so their own
        // chunk lets a returning visitor's browser keep them cached
        // across a normal app deploy instead of re-downloading on every
        // release.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
