"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { leadDecisionSchema, leadProposalSchema, leadMeetingSchema, type Lead } from "@arkanium/contracts";
import { apiFetch } from "@/lib/api";
import { bogotaToIso } from "@/lib/time";

export type ActionState = { ok: boolean; message: string } | null;

// F-02: el owner califica, pospone o descarta. Al posponer indica cuándo volver a revisar el lead.
export async function decideLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  const decision = String(formData.get("decision") ?? "");
  const revisitLocal = String(formData.get("revisitAt") ?? "");
  const revisitAt = decision === "posponer" ? (bogotaToIso(revisitLocal) ?? undefined) : undefined;

  const parsed = leadDecisionSchema.safeParse({ decision, reason: formData.get("reason"), revisitAt });
  if (!parsed.success) {
    const missingDate = decision === "posponer" && !revisitAt;
    return { ok: false, message: missingDate ? "Indica cuándo volver a revisar el lead." : "Elige una decisión y escribe el motivo." };
  }

  try {
    await apiFetch<Lead>(`/leads/${leadId}/decision`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Decisión registrada en la bitácora." };
}

// F-04: convierte un lead calificado en organización de cliente.
export async function convertLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  try {
    const result = await apiFetch<{ lead: Lead; organizationId: string }>(`/leads/${leadId}/convert`, { method: "POST" });
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: `Organización creada. Identificador: ${result.organizationId}.` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

// F-02: el owner acepta o rechaza la propuesta del agente. Aceptarla califica el lead con ese motivo.
export async function respondProposalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  const note = String(formData.get("note") ?? "").trim();
  const parsed = leadProposalSchema.safeParse({ accepted: formData.get("accepted") === "true", note: note || undefined });
  if (!parsed.success) return { ok: false, message: "La nota es demasiado larga." };

  try {
    await apiFetch<Lead>(`/leads/${leadId}/proposal`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: parsed.data.accepted ? "Propuesta aceptada: el lead quedó calificado." : "Propuesta rechazada. El estado del lead no cambia." };
}

// Reunión con un lead antes de convertirlo. Queda pendiente hasta que la confirmes en Reuniones.
export async function createLeadMeetingAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  const parsed = leadMeetingSchema.safeParse({ topic: formData.get("topic") });
  if (!parsed.success) return { ok: false, message: "Escribe el tema de la reunión." };

  try {
    await apiFetch(`/leads/${leadId}/meetings`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/reuniones");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Reunión pedida. Confírmala con una fecha en Reuniones." };
}
