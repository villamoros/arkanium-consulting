import type { Lead } from "@arkanium/contracts";

export const LEAD_STATUS_LABEL: Record<Lead["status"], string> = {
  nuevo: "Nuevo",
  calificado: "Calificado",
  pospuesto: "Pospuesto",
  descartado: "Descartado",
  convertido: "Convertido",
};

/** Familia del catálogo tal como la sugiere el agente de calificación. */
export const FAMILY_LABEL: Record<NonNullable<Lead["proposedFamily"]>, string> = {
  architecture: "Arquitectura",
  strategy: "Estrategia",
  product: "Producto",
  unknown: "Sin propuesta",
};

export const PRIORITY_LABEL: Record<string, string> = {
  architecture: "Arquitectura",
  strategy: "Estrategia",
  product: "Producto",
  unsure: "No estoy seguro",
};

const dateFormat = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
