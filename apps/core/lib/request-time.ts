import { connection } from "next/server";

/**
 * Hora de la petición actual. `connection()` marca la página como dinámica, así que la hora nunca
 * se prerenderiza con un valor fijo. Úsala en páginas de servidor en lugar de Date.now() dentro del render.
 */
export async function requestNow(): Promise<Date> {
  await connection();
  return new Date();
}
