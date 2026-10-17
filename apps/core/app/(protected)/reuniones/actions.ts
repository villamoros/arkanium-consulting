"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { bogotaToIso } from "@/lib/time";

export type MeetingActionState = { ok: boolean; message: string } | null;

type CalendarSync = { status: "sincronizada"; htmlLink: string; meetLink: string | null } | { status: "pendiente"; reason: string } | { status: "no_configurada" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

function meetingIdOf(formData: FormData): string | null {
  const id = String(formData.get("meetingId") ?? "");
  return uuid.test(id) ? id : null;
}

/** Textarea con correos separados por comas, espacios o saltos de línea. Devuelve null si alguno no es válido. */
function parseAttendees(raw: string): string[] | null {
  const list = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (list.some((value) => !email.test(value))) return null;
  return [...new Set(list.map((value) => value.toLowerCase()))];
}

function calendarMessage(sync: CalendarSync): { ok: boolean; text: string } {
  if (sync.status === "sincronizada") return { ok: true, text: "Evento creado en Google Calendar." };
  if (sync.status === "pendiente") return { ok: false, text: `El evento no se creó: ${sync.reason} Puedes reintentarlo desde la reunión.` };
  return { ok: false, text: "El calendario no está configurado, así que no se creó evento." };
}

// F-03: confirma la fecha, invita al contacto principal y a los correos extra, y crea el evento con Meet.
export async function confirmMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };

  const startsAt = bogotaToIso(String(formData.get("startsAt") ?? ""));
  if (!startsAt) return { ok: false, message: "Indica la fecha y la hora de la reunión." };

  const attendees = parseAttendees(String(formData.get("attendees") ?? ""));
  if (!attendees) return { ok: false, message: "Revisa los correos extra: uno no es válido." };

  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  try {
    const result = await apiFetch<{ calendar: CalendarSync }>(`/meetings/${meetingId}/confirm`, {
      method: "POST",
      body: { startsAt, durationMinutes, attendees },
    });
    revalidatePath("/reuniones");
    const cal = calendarMessage(result.calendar);
    // La reunión ya quedó confirmada en cualquier caso; el mensaje dice si el evento también se creó.
    return { ok: cal.ok, message: `Reunión confirmada. ${cal.text}` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// F-03: el owner rechaza la solicitud con un motivo.
export async function rejectMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Escribe el motivo del rechazo." };
  try {
    await apiFetch(`/meetings/${meetingId}/reject`, { method: "POST", body: { reason } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/reuniones");
  return { ok: true, message: "Solicitud rechazada. Queda registrada." };
}

// F-03: el owner propone otra hora; la solicitud sigue pendiente hasta que la confirmes.
export async function proposeMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  const startsAt = bogotaToIso(String(formData.get("startsAt") ?? ""));
  if (!startsAt) return { ok: false, message: "Indica la hora que propones." };
  const note = String(formData.get("note") ?? "").trim();
  try {
    await apiFetch(`/meetings/${meetingId}/propose`, { method: "POST", body: { startsAt, note: note || undefined } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/reuniones");
  return { ok: true, message: "Hora propuesta. La solicitud sigue pendiente hasta que la confirmes." };
}

// La cancelación quita el evento del calendario. Si el calendario falla, la reunión sigue confirmada.
export async function cancelMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Escribe el motivo de la cancelación." };
  try {
    await apiFetch(`/meetings/${meetingId}/cancel`, { method: "POST", body: { reason } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/reuniones");
  return { ok: true, message: "Reunión cancelada y quitada del calendario." };
}

// Reprogramar actualiza el evento existente con la nueva hora.
export async function rescheduleMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  const startsAt = bogotaToIso(String(formData.get("startsAt") ?? ""));
  if (!startsAt) return { ok: false, message: "Indica la nueva fecha y hora." };
  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  try {
    const result = await apiFetch<{ calendar: CalendarSync }>(`/meetings/${meetingId}/reschedule`, { method: "POST", body: { startsAt, durationMinutes } });
    revalidatePath("/reuniones");
    const cal = calendarMessage(result.calendar);
    return { ok: cal.ok, message: `Reunión reprogramada. ${cal.text}` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// A-05: publica el acta. Queda visible para el cliente.
export async function publishMinutesAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { ok: false, message: "Escribe el acta antes de publicarla." };
  try {
    await apiFetch(`/meetings/${meetingId}/minutes`, { method: "POST", body: { text } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/reuniones");
  return { ok: true, message: "Acta publicada. El cliente ya puede verla." };
}

// Reintenta crear el evento de una reunión confirmada cuya sincronización quedó pendiente.
export async function retryCalendarAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = meetingIdOf(formData);
  if (!meetingId) return { ok: false, message: "Reunión no válida." };
  try {
    const result = await apiFetch<{ calendar: CalendarSync }>(`/meetings/${meetingId}/calendar/retry`, { method: "POST" });
    revalidatePath("/reuniones");
    const cal = calendarMessage(result.calendar);
    return { ok: cal.ok, message: cal.text };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
