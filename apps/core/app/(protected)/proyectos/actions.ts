"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api";
import { bogotaToIso } from "@/lib/time";

export type ProjectActionState = { ok: boolean; message: string } | null;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICE_FAMILIES = ["architecture", "strategy", "product", "unknown"];
const PHASES = ["evaluar", "arquitectar", "modernizar", "escalar"];
const MILESTONE_STATUSES = ["pendiente", "en_curso", "completado"];

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la acción. Intenta de nuevo.";
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function choice(formData: FormData, key: string, allowed: string[]): string | null {
  const value = text(formData, key);
  return allowed.includes(value) ? value : null;
}

// Crear un proyecto para un cliente. Igual que en la app, el cliente lo verá con su avance.
export async function createProjectAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const organizationId = text(formData, "organizationId");
  if (!uuid.test(organizationId)) return { ok: false, message: "Elige el cliente del proyecto." };

  const name = text(formData, "name");
  if (!name) return { ok: false, message: "Escribe el nombre del proyecto." };

  const serviceFamily = choice(formData, "serviceFamily", SERVICE_FAMILIES) ?? "unknown";
  const phase = choice(formData, "phase", PHASES) ?? "evaluar";

  try {
    await apiFetch(`/organizations/${organizationId}/projects`, {
      method: "POST",
      body: { name, serviceFamily, phase, progress: text(formData, "progress"), nextStep: text(formData, "nextStep") },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/proyectos");
  return { ok: true, message: "Proyecto creado." };
}

// Corregir datos del proyecto: solo se envían los campos que se llenaron.
export async function updateProjectAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = text(formData, "projectId");
  if (!uuid.test(projectId)) return { ok: false, message: "Proyecto no válido." };

  const body: Record<string, string> = {};
  const name = text(formData, "name");
  if (name) body.name = name;
  const family = choice(formData, "serviceFamily", SERVICE_FAMILIES);
  if (family) body.serviceFamily = family;
  const phase = choice(formData, "phase", PHASES);
  if (phase) body.phase = phase;
  if (formData.has("progress")) body.progress = text(formData, "progress");
  if (formData.has("nextStep")) body.nextStep = text(formData, "nextStep");
  if (Object.keys(body).length === 0) return { ok: false, message: "Cambia al menos un dato." };

  try {
    await apiFetch(`/projects/${projectId}`, { method: "PATCH", body });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, message: "Proyecto actualizado." };
}

// Agregar un hito con fecha prevista (D-21: el cliente ve la fecha prevista).
export async function addMilestoneAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = text(formData, "projectId");
  if (!uuid.test(projectId)) return { ok: false, message: "Proyecto no válido." };
  const name = text(formData, "name");
  if (!name) return { ok: false, message: "Escribe el nombre del hito." };

  const dateLocal = text(formData, "plannedDate");
  const plannedDate = dateLocal ? bogotaToIso(dateLocal) : null;
  if (dateLocal && !plannedDate) return { ok: false, message: "La fecha prevista no es válida." };

  try {
    await apiFetch(`/projects/${projectId}/milestones`, { method: "POST", body: { name, ...(plannedDate ? { plannedDate } : {}) } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, message: "Hito agregado." };
}

// Cambiar el estado de un hito.
export async function setMilestoneStatusAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = text(formData, "projectId");
  const milestoneId = text(formData, "milestoneId");
  if (!uuid.test(milestoneId)) return { ok: false, message: "Hito no válido." };
  const status = choice(formData, "status", MILESTONE_STATUSES);
  if (!status) return { ok: false, message: "Estado no válido." };

  try {
    await apiFetch(`/milestones/${milestoneId}`, { method: "PATCH", body: { status } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, message: "Estado del hito actualizado." };
}

// Archivar: el proyecto deja de aparecer en las listas y en la app del cliente. No se borra.
export async function archiveProjectAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = text(formData, "projectId");
  if (!uuid.test(projectId)) return { ok: false, message: "Proyecto no válido." };
  const reason = text(formData, "reason");
  if (!reason) return { ok: false, message: "Escribe el motivo para archivarlo." };

  try {
    await apiFetch(`/projects/${projectId}`, { method: "DELETE", body: { reason } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/proyectos");
  return { ok: true, message: "Proyecto archivado. Su historial se conserva." };
}
