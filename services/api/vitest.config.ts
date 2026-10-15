import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // El primer arranque tras instalar (cache de módulos fría en Windows) puede pasar de los 5 s por defecto.
    testTimeout: 15_000,
  },
});
