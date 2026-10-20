import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de Core en Node: acciones de servidor, helpers y lógica pura. Los componentes de cliente se prueban
// con su propia configuración cuando una rebanada los necesite.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${fileURLToPath(new URL("./", import.meta.url))}` }],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
