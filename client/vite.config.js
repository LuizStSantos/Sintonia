import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Lê a versão direto do package.json em tempo de build, e injeta como uma
// constante global (__APP_VERSION__) que o AppCredit.jsx usa no rodapé. Antes
// a versão exibida ali era um texto fixo dentro do componente, esquecido
// manualmente desatualizado por várias entregas seguidas (ficou em "v1.1.0"
// por muito tempo enquanto o package.json já estava em 1.4.x) — agora é
// impossível ela ficar desincronizada, porque não existe mais um segundo
// lugar pra lembrar de atualizar.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
