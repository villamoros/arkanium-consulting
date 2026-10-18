"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { billingEmailSchema, memberInvitationSchema, memberRoleSchema, organizationSuspendSchema } from "@arkanium/contracts";
import { apiFetch } from "@/lib/api";

export type ClientActionState = { ok: boolean; message: string } | null;

const userIdPattern = /^[A-Za-z0-9_]+$/;

function orgIdOf(formData: FormData): string | null {
  const id = String(formData.get("organizationId") ?? "");
  return isUuid(id) ? id : null;
}

// Invitar a una persona al cliente: Arkanium envía la invitación, el cliente no invita por su cuenta (D-03).
export async function inviteMemberAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  if (!organizationId) return { ok: false, message: "Cliente no válido." };

  const parsed = memberInvitationSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: "Revisa el correo y el rol." };

  try {
    await apiFetch(`/organizations/${organizationId}/invitations`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: "Invitación enviada. La persona la acepta desde su correo." };
}

// Cambia el rol de una persona. La API impide dejar la organización sin administrador.
export async function setMemberRoleAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  const userId = String(formData.get("userId") ?? "");
  if (!organizationId || !userIdPattern.test(userId)) return { ok: false, message: "Persona no válida." };

  const parsed = memberRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: "Rol no válido." };

  try {
    await apiFetch(`/organizations/${organizationId}/members/${userId}`, { method: "PATCH", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: "Rol actualizado." };
}

// Retira a una persona del cliente. Deja de tener acceso a sus proyectos; su historial se conserva.
export async function removeMemberAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  const userId = String(formData.get("userId") ?? "");
  if (!organizationId || !userIdPattern.test(userId)) return { ok: false, message: "Persona no válida." };

  try {
    await apiFetch(`/organizations/${organizationId}/members/${userId}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: "Persona retirada. Su historial queda en la bitácora." };
}

// Suspende el acceso del cliente a la app. No borra nada; el motivo queda en la bitácora.
export async function suspendClientAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  if (!organizationId) return { ok: false, message: "Cliente no válido." };

  const parsed = organizationSuspendSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, message: "Escribe el motivo para suspender." };

  try {
    await apiFetch(`/organizations/${organizationId}/suspend`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: "Acceso suspendido. Nada se borró." };
}

// Correo donde Stripe envía las facturas del cliente. Vacío lo borra. La API valida el formato.
export async function setBillingEmailAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  if (!organizationId) return { ok: false, message: "Cliente no válido." };

  const billingEmail = String(formData.get("billingEmail") ?? "").trim();
  if (!billingEmailSchema.safeParse({ billingEmail }).success) return { ok: false, message: "Revisa el correo de facturación." };

  try {
    await apiFetch(`/organizations/${organizationId}/billing-email`, { method: "PATCH", body: { billingEmail } });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: billingEmail ? "Correo de facturación guardado." : "Correo de facturación borrado." };
}

// Reactiva el acceso; vuelve de inmediato.
export async function reactivateClientAction(_previous: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const organizationId = orgIdOf(formData);
  if (!organizationId) return { ok: false, message: "Cliente no válido." };

  try {
    await apiFetch(`/organizations/${organizationId}/reactivate`, { method: "POST" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/clientes`);
  return { ok: true, message: "Acceso reactivado." };
}
