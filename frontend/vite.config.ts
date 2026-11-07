import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// A URL do analysis-service vem de VITE_API_URL (ver src/api); nunca fixar IPs aqui.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000, host: true },
});
