"use server";

import { revalidatePath } from "next/cache";
import { leadDecisionSchema, type Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";

export type ActionState = { ok: boolean; message: string } | null;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

// F-02: el owner califica, pospone o descarta. La API vuelve a comprobar que sea el owner.
export async function decideLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!uuid.test(leadId)) return { ok: false, message: "Lead no válido." };

  const parsed = leadDecisionSchema.safeParse({ decision: formData.get("decision"), reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, message: "Elige una decisión y escribe el motivo." };

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
  if (!uuid.test(leadId)) return { ok: false, message: "Lead no válido." };

  try {
    const result = await apiFetch<{ lead: Lead; organizationId: string }>(`/leads/${leadId}/convert`, { method: "POST" });
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: `Organización creada. Identificador: ${result.organizationId}.` };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
