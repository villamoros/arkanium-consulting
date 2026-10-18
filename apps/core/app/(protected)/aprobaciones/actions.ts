"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export type ApprovalActionState = { ok: boolean; message: string } | null;

// Aprueba un elemento de la cola ejecutando la acción que ya existe en su módulo.
export async function approveItemAction(_previous: ApprovalActionState, formData: FormData): Promise<ApprovalActionState> {
  const action = String(formData.get("action") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!isUuid(subjectId)) return { ok: false, message: "Elemento no válido." };

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
    if (action === "aprobar_brief") {
      await apiFetch(`/campaigns/${subjectId}/brief/approve`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/campanas");
      return { ok: true, message: "Brief aprobado. Ya se pueden producir piezas para la campaña." };
    }
    if (action === "aprobar_pieza") {
      await apiFetch(`/campaign-pieces/${subjectId}/approve`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/campanas");
      return { ok: true, message: "Pieza aprobada. Su publicación la hace el agente después." };
    }
    if (action === "publicar_articulo") {
      await apiFetch(`/articles/${subjectId}/publish`, { method: "POST" });
      revalidatePath("/aprobaciones");
      revalidatePath("/insights");
      return { ok: true, message: "Artículo publicado en Insights." };
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
