import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // El primer arranque tras instalar (cache de módulos fría en Windows) puede pasar de los 5 s por defecto.
    testTimeout: 15_000,
    // La base embebida (PGlite) carga su motor en el primer arranque: los hooks necesitan más margen.
    hookTimeout: 60_000,
    // Cada archivo levanta su propia base embebida. En paralelo, en Windows, los workers se caían al crearlas
    // (salida 2147483651). En serie la suite tarda más, pero es estable.
    fileParallelism: false,
  },
});
