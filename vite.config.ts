import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: { manualChunks: { supabase: ["@supabase/supabase-js"] } },
    },
  },
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
});
