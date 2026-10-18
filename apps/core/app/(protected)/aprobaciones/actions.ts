"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";

export type ApprovalActionState = { ok: boolean; message: string } | null;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

// Aprueba un elemento de la cola ejecutando la acción que ya existe en su módulo.
export async function approveItemAction(_previous: ApprovalActionState, formData: FormData): Promise<ApprovalActionState> {
  const action = String(formData.get("action") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!uuid.test(subjectId)) return { ok: false, message: "Elemento no válido." };

  try {
    if (action === "enviar_propuesta") {
      await apiFetch(`/proposals/${subjectId}/sent`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/propuestas");
      return { ok: true, message: "Propuesta registrada como enviada." };
    }
    if (action === "emitir_factura") {
      await apiFetch(`/invoices/${subjectId}/issue`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/cobros");
      return { ok: true, message: "Factura emitida en Stripe. El cliente ya puede pagarla desde su enlace." };
    }
    if (action === "crear_evento") {
      await apiFetch(`/meetings/${subjectId}/calendar/retry`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/reuniones");
      return { ok: true, message: "Evento creado en Google Calendar." };
    }
    return { ok: false, message: "Esta acción se resuelve en su módulo." };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
