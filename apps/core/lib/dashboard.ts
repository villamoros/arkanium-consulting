import type { Lead } from "@arkanium/contracts";
import { LEAD_STATUS_LABEL, SOURCE_LABEL } from "@/lib/labels";

/** Una barra con su etiqueta y su valor. */
export type Bar = { label: string; value: number };

/** Una columna de tiempo: una etiqueta y uno o más valores (una serie por valor). */
export type Column = { label: string; values: number[] };

/** Lo que el tablero necesita de cada reunión. */
export type MeetingPoint = { requestedAt: string; startsAt: string | null; status: string };

const WEEKS = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const dayLabel = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "America/Bogota" });

/** Inicio de cada una de las últimas 12 semanas de 7 días, la más antigua primero. */
function weekStarts(now: number): number[] {
  return Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * WEEK_MS);
}

function countIn(times: number[], start: number): number {
  return times.filter((t) => t >= start && t < start + WEEK_MS).length;
}

/** Embudo: cuántos leads hay en cada estado, en el orden del proceso. */
export function leadsByStatus(leads: Lead[]): Bar[] {
  return (Object.keys(LEAD_STATUS_LABEL) as Lead["status"][]).map((status) => ({
    label: LEAD_STATUS_LABEL[status],
    value: leads.filter((lead) => lead.status === status).length,
  }));
}

/** Canales: de dónde llegan los leads, del que más trae al que menos. */
export function leadsBySource(leads: Lead[]): Bar[] {
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(lead.source, (counts.get(lead.source) ?? 0) + 1);
  return [...counts]
    .map(([source, value]) => ({ label: SOURCE_LABEL[source] ?? source, value }))
    .sort((a, b) => b.value - a.value);
}

/** Captación: leads que llegaron cada semana. */
export function leadsPerWeek(leads: Lead[], now: number): Column[] {
  const times = leads.map((lead) => new Date(lead.receivedAt).getTime());
  return weekStarts(now).map((start) => ({ label: dayLabel.format(start), values: [countIn(times, start)] }));
}

/**
 * Reuniones: solicitudes recibidas frente a reuniones programadas cada semana.
 * Las programadas se cuentan por su fecha; las pendientes de confirmar no tienen fecha, así que no entran.
 */
export function meetingsPerWeek(meetings: MeetingPoint[], now: number): Column[] {
  const requested = meetings.map((m) => new Date(m.requestedAt).getTime());
  const scheduled = meetings
    .filter((m) => m.status !== "solicitada" && m.startsAt)
    .map((m) => new Date(m.startsAt!).getTime());
  return weekStarts(now).map((start) => ({
    label: dayLabel.format(start),
    values: [countIn(requested, start), countIn(scheduled, start)],
  }));
}
