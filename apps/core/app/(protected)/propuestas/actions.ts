"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export type ProposalActionState = { ok: boolean; message: string } | null;

const FAMILIES = ["architecture", "strategy", "product", "unknown"];

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Precio en dólares escrito por el owner, convertido a centavos. Vacío significa «por confirmar». */
function priceFields(formData: FormData): { priceStatus: "por_confirmar" | "confirmado"; priceCents?: number; priceNote?: string } | { error: string } {
  const amount = text(formData, "price");
  const note = text(formData, "priceNote");
  if (!amount && !note) return { priceStatus: "por_confirmar" };
  if (amount) {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return { error: "El precio no es válido." };
    return { priceStatus: "confirmado", priceCents: Math.round(value * 100), ...(note ? { priceNote: note } : {}) };
  }
  return { priceStatus: "confirmado", priceNote: note };
}

// Crear una propuesta para un cliente o un lead calificado. Empieza como borrador.
export async function createProposalAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  const kind = text(formData, "kind");
  const target = text(formData, "target");
  if (kind !== "cliente" && kind !== "lead") return { ok: false, message: "Elige si es para un cliente o un lead." };
  if (!isUuid(target)) return { ok: false, message: "Elige a quién va la propuesta." };

  const title = text(formData, "title");
  const summary = text(formData, "summary");
  const templateCode = text(formData, "templateCode");
  if (!title || !summary || !templateCode) return { ok: false, message: "Completa el título, la plantilla y el resumen." };

  const price = priceFields(formData);
  if ("error" in price) return { ok: false, message: price.error };
  const family = FAMILIES.includes(text(formData, "serviceFamily")) ? text(formData, "serviceFamily") : "unknown";

  const body = {
    kind,
    ...(kind === "cliente" ? { organizationId: target } : { leadId: target }),
    title,
    serviceFamily: family,
    templateCode,
    summary,
    ...price,
  };
  try {
    await apiFetch("/proposals", { method: "POST", body });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/propuestas");
  return { ok: true, message: "Propuesta creada como borrador." };
}

// Nueva versión: solo en borrador. Cada cambio queda registrado.
export async function addVersionAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  const id = text(formData, "proposalId");
  if (!isUuid(id)) return { ok: false, message: "Propuesta no válida." };
  const summary = text(formData, "summary");
  if (!summary) return { ok: false, message: "Escribe el resumen de la propuesta." };
  const price = priceFields(formData);
  if ("error" in price) return { ok: false, message: price.error };

  try {
    await apiFetch(`/proposals/${id}/versions`, { method: "POST", body: { summary, ...price } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/propuestas");
  return { ok: true, message: "Nueva versión creada." };
}

async function simpleAction(formData: FormData, path: string, successMessage: string): Promise<ProposalActionState> {
  const id = text(formData, "proposalId");
  if (!isUuid(id)) return { ok: false, message: "Propuesta no válida." };
  try {
    await apiFetch(`/proposals/${id}/${path}`, { method: "POST" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/propuestas");
  return { ok: true, message: successMessage };
}

export async function sendToApprovalAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  return simpleAction(formData, "approval", "Enviada a aprobación.");
}

export async function markSentAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  return simpleAction(formData, "sent", "Registrada como enviada. Arkanium no envía correos desde aquí.");
}

async function decisionAction(formData: FormData, path: string, field: string, successMessage: string): Promise<ProposalActionState> {
  const id = text(formData, "proposalId");
  if (!isUuid(id)) return { ok: false, message: "Propuesta no válida." };
  const note = text(formData, "note");
  if (!note) return { ok: false, message: field === "signature" ? "Escribe la referencia de la firma." : "Escribe el motivo." };
  try {
    await apiFetch(`/proposals/${id}/${path}`, { method: "POST", body: { note } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/propuestas");
  return { ok: true, message: successMessage };
}

export async function acceptProposalAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  return decisionAction(formData, "accept", "signature", "Aceptación registrada con la firma adjunta.");
}

export async function rejectProposalAction(_previous: ProposalActionState, formData: FormData): Promise<ProposalActionState> {
  return decisionAction(formData, "reject", "reason", "Rechazo registrado. Queda en la bitácora.");
}
