"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { bogotaToIso } from "@/lib/time";
import type { MeetingActionState } from "./actions";

type CalendarSync = { status: "sincronizada"; htmlLink: string; meetLink: string | null } | { status: "pendiente"; reason: string } | { status: "no_configurada" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

/** Correos separados por comas, espacios o saltos de línea. Devuelve null si alguno no es válido. */
function parseAttendees(raw: string): string[] | null {
  const list = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (list.some((value) => !email.test(value))) return null;
  return [...new Set(list.map((value) => value.toLowerCase()))];
}

function calendarText(sync: CalendarSync | null): string {
  if (!sync) return "";
  if (sync.status === "sincronizada") return " Evento actualizado en Google Calendar.";
  if (sync.status === "pendiente") return ` El calendario quedó pendiente: ${sync.reason} Puedes reintentarlo desde la reunión.`;
  return " El calendario no está configurado.";
}

// Crear a mano: con fecha queda confirmada y se intenta el evento; sin fecha queda como solicitud.
export async function createManualMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const kind = String(formData.get("kind") ?? "");
  const target = String(formData.get("target") ?? "");
  if (kind !== "cliente" && kind !== "lead") return { ok: false, message: "Elige si la reunión es con un cliente o con un lead." };
  if (!uuid.test(target)) return { ok: false, message: "Elige el cliente o el lead." };

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) return { ok: false, message: "Escribe el tema de la reunión." };

  const startLocal = String(formData.get("startsAt") ?? "");
  const startsAt = startLocal ? bogotaToIso(startLocal) : null;
  if (startLocal && !startsAt) return { ok: false, message: "La fecha no es válida." };

  const attendees = parseAttendees(String(formData.get("attendees") ?? ""));
  if (!attendees) return { ok: false, message: "Revisa los correos extra: uno no es válido." };

  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  const body = {
    kind,
    ...(kind === "cliente" ? { organizationId: target } : { leadId: target }),
    topic,
    ...(startsAt ? { startsAt, durationMinutes } : {}),
    attendees,
  };

  try {
    const result = await apiFetch<{ calendar: CalendarSync | null }>("/meetings/manual", { method: "POST", body });
    revalidatePath("/reuniones");
    return { ok: true, message: `Reunión creada.${calendarText(result.calendar)}` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// Corregir a mano: solo se envían los campos que se llenaron.
export async function updateMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = String(formData.get("meetingId") ?? "");
  if (!uuid.test(meetingId)) return { ok: false, message: "Reunión no válida." };

  const body: Record<string, unknown> = {};
  const topic = String(formData.get("topic") ?? "").trim();
  if (topic) body.topic = topic;

  const attendeesRaw = String(formData.get("attendees") ?? "").trim();
  if (attendeesRaw) {
    const attendees = parseAttendees(attendeesRaw);
    if (!attendees) return { ok: false, message: "Revisa los correos: uno no es válido." };
    body.attendees = attendees;
  }

  const startLocal = String(formData.get("startsAt") ?? "");
  if (startLocal) {
    const startsAt = bogotaToIso(startLocal);
    if (!startsAt) return { ok: false, message: "La nueva fecha no es válida." };
    body.startsAt = startsAt;
    body.durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  }

  if (formData.get("skipCalendar") === "on") body.skipCalendar = true;
  if (!("topic" in body) && !("attendees" in body) && !("startsAt" in body)) return { ok: false, message: "Cambia al menos un dato." };

  try {
    const result = await apiFetch<{ calendar: CalendarSync | null }>(`/meetings/${meetingId}`, { method: "PATCH", body });
    revalidatePath("/reuniones");
    return { ok: true, message: `Reunión actualizada.${calendarText(result.calendar)}` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// Eliminar: borrado lógico. Si el calendario no puede quitar el evento, no se elimina salvo que se marque «forzar».
export async function deleteMeetingAction(_previous: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const meetingId = String(formData.get("meetingId") ?? "");
  if (!uuid.test(meetingId)) return { ok: false, message: "Reunión no válida." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "Escribe el motivo para eliminarla." };

  try {
    const result = await apiFetch<{ eventLeft: boolean }>(`/meetings/${meetingId}`, {
      method: "DELETE",
      body: { reason, force: formData.get("force") === "on" },
    });
    revalidatePath("/reuniones");
    return {
      ok: true,
      message: result.eventLeft
        ? "Reunión eliminada de Arkanium. El evento sigue en Google Calendar: quítalo a mano."
        : "Reunión eliminada. Su registro y su bitácora se conservan.",
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
