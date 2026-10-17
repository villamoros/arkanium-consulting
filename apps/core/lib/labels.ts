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

/** Origen del lead: cómo llegó a la plataforma. */
export const SOURCE_LABEL: Record<string, string> = {
  website: "Sitio web",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  "mensaje-directo": "Mensaje directo",
  referido: "Referido",
  evento: "Evento",
  otro: "Otro",
};

/** Estado de una reunión: la solicita el cliente o el owner, la confirma el owner y se cierra con el acta. */
export const MEETING_STATUS_LABEL: Record<"solicitada" | "confirmada" | "realizada" | "rechazada" | "cancelada", string> = {
  solicitada: "Por responder",
  confirmada: "Confirmada",
  realizada: "Realizada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

/** Estado de la sincronización con Google Calendar. */
export const CALENDAR_STATUS_LABEL: Record<string, string> = {
  sincronizada: "En el calendario",
  pendiente: "Pendiente de calendario",
  no_configurada: "Sin calendario",
  cancelada: "Quitada del calendario",
};

/** Nombres legibles de las acciones de la bitácora de un lead. */
export const LEAD_EVENT_LABEL: Record<string, string> = {
  "lead.calificar": "Calificado",
  "lead.posponer": "Pospuesto",
  "lead.descartar": "Descartado",
  "lead.propuesta_aceptada": "Propuesta del agente aceptada",
  "lead.propuesta_rechazada": "Propuesta del agente rechazada",
  "lead.updated": "Datos editados",
  "lead.converted": "Convertido en organización",
  "lead.deleted": "Eliminado",
};

/** Fase de un proyecto: de evaluar a escalar. */
export const PHASE_LABEL: Record<"evaluar" | "arquitectar" | "modernizar" | "escalar", string> = {
  evaluar: "Evaluar",
  arquitectar: "Arquitectar",
  modernizar: "Modernizar",
  escalar: "Escalar",
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
