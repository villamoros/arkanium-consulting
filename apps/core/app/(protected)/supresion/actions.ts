"use server";

import { revalidatePath } from "next/cache";
import { suppressionSchema } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";

export type SuppressionActionState = { ok: boolean; message: string } | null;

// Consentimiento y baja: el correo deja de recibir contactos de Arkanium. Cada alta queda en la bitácora.
export async function addSuppressionAction(_previous: SuppressionActionState, formData: FormData): Promise<SuppressionActionState> {
  const parsed = suppressionSchema.safeParse({ email: formData.get("email"), reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, message: "Revisa el correo y escribe el motivo." };

  try {
    await apiFetch("/suppressions", { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "No pudimos guardar la supresión. Intenta de nuevo." };
  }
  revalidatePath("/supresion");
  return { ok: true, message: "Correo añadido a la lista de supresión." };
}
