"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { leadDeleteSchema, leadManualSchema, leadUpdateSchema, type Lead } from "@arkanium/contracts";
import { apiFetch } from "@/lib/api";
import type { ActionState } from "./actions";

/** Texto de un campo; vacío se trata como ausente. */
function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Alta manual: mensaje directo, comentario, referido o evento. Queda en la bitácora con su origen.
export async function createManualLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadManualSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    company: field(formData, "company"),
    priority: field(formData, "priority") ?? "unsure",
    context: field(formData, "context"),
    locale: field(formData, "locale") ?? "es",
    source: field(formData, "source"),
    sourceReference: field(formData, "sourceReference"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del lead." };

  let lead: Lead;
  try {
    lead = await apiFetch<Lead>("/leads/manual", { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

// Edición de datos. Un lead convertido no se edita aquí: la API lo rechaza con un mensaje claro.
export async function updateLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  // Solo se envían los campos que llegaron en el formulario: un lead convertido tiene menos campos editables.
  const nullable = ["company", "context", "sourceReference"];
  const raw: Record<string, unknown> = {};
  for (const key of ["name", "email", "company", "priority", "context", "source", "sourceReference"]) {
    if (!formData.has(key)) continue;
    const value = field(formData, key);
    if (value === undefined && !nullable.includes(key)) return { ok: false, message: "Nombre y correo no pueden quedar vacíos." };
    raw[key] = nullable.includes(key) ? (value ?? null) : value;
  }
  const parsed = leadUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos del lead." };

  try {
    await apiFetch<Lead>(`/leads/${leadId}`, { method: "PATCH", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Datos guardados. Queda registrado en la bitácora." };
}

// Eliminación suave. Exige motivo; el registro se conserva y la lista deja de mostrarlo.
export async function deleteLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!isUuid(leadId)) return { ok: false, message: "Lead no válido." };

  const parsed = leadDeleteSchema.safeParse({ reason: field(formData, "reason") });
  if (!parsed.success) return { ok: false, message: "Escribe el motivo para eliminar el lead." };

  try {
    await apiFetch<void>(`/leads/${leadId}`, { method: "DELETE", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/leads");
  redirect("/leads");
}
