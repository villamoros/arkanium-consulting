"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export type EmergencyActionState = { ok: boolean; message: string } | null;

const departments = ["arquitectura", "estrategia", "producto"];

/**
 * Una sola acción para todas las pausas. El tipo de operación decide la ruta de la API.
 * Pausar exige un motivo; reanudar lo acepta opcional. Todo queda en la bitácora.
 */
export async function emergencyAction(_previous: EmergencyActionState, formData: FormData): Promise<EmergencyActionState> {
  const op = String(formData.get("op") ?? "");
  const target = String(formData.get("target") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const pausing = op.startsWith("pause");
  if (pausing && !reason) return { ok: false, message: "Escribe el motivo de la pausa." };

  let path: string;
  let message: string;
  if (op === "pause-all") {
    path = "/emergency/pause-all";
    message = "Todo en pausa. Queda registrado en la bitácora.";
  } else if (op === "resume-all") {
    path = "/emergency/resume-all";
    message = "Operación reanudada. Queda registrado en la bitácora.";
  } else if (op === "pause-dept" || op === "resume-dept") {
    if (!departments.includes(target)) return { ok: false, message: "Departamento no válido." };
    path = `/emergency/departments/${target}/${pausing ? "pause" : "resume"}`;
    message = pausing ? "Departamento en pausa. Queda registrado en la bitácora." : "Departamento reanudado. Queda registrado en la bitácora.";
  } else if (op === "pause-agent" || op === "resume-agent") {
    if (!isUuid(target)) return { ok: false, message: "Agente no válido." };
    path = `/agents/${target}/${pausing ? "pause" : "resume"}`;
    message = pausing ? "Agente en pausa. Queda registrado en la bitácora." : "Agente reanudado. Queda registrado en la bitácora.";
  } else {
    return { ok: false, message: "Acción no válida." };
  }

  try {
    await apiFetch(path, { method: "POST", body: reason ? { reason } : undefined });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/pausas");
  return { ok: true, message };
}
