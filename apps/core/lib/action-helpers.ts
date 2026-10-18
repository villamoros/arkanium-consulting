import { ApiError } from "@/lib/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cierto si el valor es un identificador válido. Las acciones lo validan antes de llamar a la API. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Mensaje para el owner cuando una acción falla: el de la API si lo hay, o uno genérico. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}
