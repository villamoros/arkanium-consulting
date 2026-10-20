"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { creditNoteSchema, invoiceDraftSchema, type InvoiceDraft } from "@arkanium/contracts";
import { apiFetch } from "@/lib/api";

export type InvoiceActionState = { ok: boolean; message: string } | null;

/** Un monto escrito en dólares (900, 900.50 o 900,50) a centavos. Devuelve 0 si no es un número. */
function centsOf(value: FormDataEntryValue | string | null | undefined): number {
  const number = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

/** Lee el borrador del formulario. Las líneas llegan como JSON con los montos en dólares. */
function draftFrom(formData: FormData): { ok: true; draft: InvoiceDraft } | { ok: false; message: string } {
  let rawLines: Array<{ description?: string; quantity?: string; amount?: string }>;
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { ok: false, message: "Revisa las líneas de la factura." };
  }
  const lines = rawLines.map((line) => ({
    description: String(line.description ?? "").trim(),
    quantity: Number(line.quantity ?? 0),
    unitAmountCents: centsOf(line.amount),
  }));
  const projectId = String(formData.get("projectId") ?? "");
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const parsed = invoiceDraftSchema.safeParse({
    ...(isUuid(projectId) ? { projectId } : {}),
    ...(recipientEmail ? { recipientEmail } : {}),
    concept: formData.get("concept"),
    lines,
    dueDays: Number(formData.get("dueDays") ?? 30),
  });
  if (!parsed.success) {
    return { ok: false, message: "Revisa el concepto, el correo (si lo escribiste) y que cada línea tenga descripción, cantidad y precio mayores que cero." };
  }
  return { ok: true, draft: parsed.data };
}

// Crea un borrador de factura. No sale hasta que lo apruebas en Aprobaciones.
export async function createInvoiceAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!isUuid(organizationId)) return { ok: false, message: "Elige el cliente." };

  const result = draftFrom(formData);
  if (!result.ok) return result;

  try {
    await apiFetch(`/organizations/${organizationId}/invoices`, { method: "POST", body: result.draft });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  revalidatePath("/aprobaciones");
  return { ok: true, message: "Borrador guardado. Emítelo desde Aprobaciones cuando esté listo." };
}

// Corrige un borrador. Una factura emitida no se edita.
export async function updateInvoiceAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { ok: false, message: "Factura no válida." };

  const result = draftFrom(formData);
  if (!result.ok) return result;

  try {
    await apiFetch(`/invoices/${invoiceId}`, { method: "PUT", body: result.draft });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  revalidatePath("/aprobaciones");
  return { ok: true, message: "Borrador actualizado." };
}

// Descarta un borrador. Queda oculto; su número no se reutiliza.
export async function discardInvoiceAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { ok: false, message: "Factura no válida." };
  try {
    await apiFetch(`/invoices/${invoiceId}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  revalidatePath("/aprobaciones");
  return { ok: true, message: "Borrador descartado." };
}

// Reenvía una factura emitida y sin pagar al correo de facturación del cliente.
export async function remindInvoiceAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { ok: false, message: "Factura no válida." };
  try {
    await apiFetch(`/invoices/${invoiceId}/reminder`, { method: "POST" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  return { ok: true, message: "Recordatorio enviado al correo de facturación del cliente." };
}

// Nota de crédito sobre una factura pagada. El monto vuelve al cliente desde Stripe.
export async function creditNoteAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { ok: false, message: "Factura no válida." };

  const parsed = creditNoteSchema.safeParse({
    amountCents: centsOf(formData.get("amount")),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, message: "Escribe un monto mayor que cero y el motivo." };

  try {
    await apiFetch(`/invoices/${invoiceId}/credit-notes`, { method: "POST", body: parsed.data });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  return { ok: true, message: "Nota de crédito creada. El monto se devuelve desde Stripe." };
}

// Anula una factura emitida. Queda en la bitácora.
export async function voidInvoiceAction(_previous: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { ok: false, message: "Factura no válida." };
  try {
    await apiFetch(`/invoices/${invoiceId}/void`, { method: "POST" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/cobros");
  return { ok: true, message: "Factura anulada. Queda en la bitácora." };
}
