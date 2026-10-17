/**
 * Convierte la hora que escribe el owner (Bogotá, UTC-5, sin zona) a ISO en UTC, que es lo que pide la API.
 * Devuelve null si el valor no es una fecha y hora válida.
 */
export function bogotaToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(`${local}:00-05:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
