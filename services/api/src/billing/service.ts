/**
 * F-10 y A-06: facturas. El owner redacta y emite desde core; el cliente ve su factura y paga en la
 * página segura de Stripe. Ningún agente emite ni cobra: toda emisión la aprueba el owner.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { invoiceCreditNotes, invoiceLines, invoices, organizations, projects } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { BillingGateway } from './stripe.js';
import { BillingError } from './stripe.js';
import type { InvoiceDraft, CreditNote } from '@arkanium/contracts';

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineRow = typeof invoiceLines.$inferSelect;

/** Factura activa: los borradores descartados no existen para nadie. */
export async function findInvoice(db: Db, id: string): Promise<Invoice> {
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!invoice) throw new ServiceError(404, 'not_found', 'Factura no encontrada.');
  return invoice;
}

/** Numeración F-AAAA-NNNN, consecutiva por año. */
async function nextNumber(db: Db): Promise<string> {
  const year = new Date().getUTCFullYear();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(invoices);
  return `F-${year}-${String((row?.count ?? 0) + 1).padStart(4, '0')}`;
}

/** Suma de las líneas en centavos. */
function totalOf(lines: Array<{ quantity: number; unitAmountCents: number }>): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitAmountCents, 0);
}

function requireDraft(invoice: Invoice, message: string): void {
  if (invoice.status !== 'borrador') throw new ServiceError(409, 'invalid_state', message);
}

export async function createDraft(db: Db, organizationId: string, input: InvoiceDraft, actor: string): Promise<Invoice> {
  const number = await nextNumber(db);
  const amountCents = totalOf(input.lines);
  const invoice = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(invoices)
      .values({
        organizationId,
        projectId: input.projectId ?? null,
        number,
        concept: input.concept,
        amountCents,
        dueDays: input.dueDays,
        recipientEmail: input.recipientEmail?.toLowerCase() ?? null,
      })
      .returning();
    await tx.insert(invoiceLines).values(input.lines.map((line, position) => ({ ...line, invoiceId: created!.id, position })));
    return created!;
  });
  await audit(db, { actor, action: 'invoice.drafted', subjectType: 'invoice', subjectId: invoice.id, detail: { number, amountCents, lines: input.lines.length } });
  return invoice;
}

/** Corrige un borrador: concepto, proyecto, plazo y líneas. Una factura emitida no se edita. */
export async function updateDraft(db: Db, id: string, input: InvoiceDraft, actor: string): Promise<Invoice> {
  const current = await findInvoice(db, id);
  requireDraft(current, 'Solo se edita un borrador. Una factura emitida se anula y se hace otra.');
  const amountCents = totalOf(input.lines);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(invoices)
      .set({
        concept: input.concept,
        projectId: input.projectId ?? null,
        dueDays: input.dueDays,
        amountCents,
        recipientEmail: input.recipientEmail?.toLowerCase() ?? null,
      })
      .where(eq(invoices.id, id))
      .returning();
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    await tx.insert(invoiceLines).values(input.lines.map((line, position) => ({ ...line, invoiceId: id, position })));
    return row!;
  });
  await audit(db, { actor, action: 'invoice.updated', subjectType: 'invoice', subjectId: id, detail: { amountCents, lines: input.lines.length } });
  return updated;
}

/** Descarta un borrador. Borrado lógico: el número queda consumido y nadie lo ve. */
export async function discardDraft(db: Db, id: string, actor: string): Promise<void> {
  const invoice = await findInvoice(db, id);
  requireDraft(invoice, 'Solo se descarta un borrador. Una factura emitida se anula.');
  await db.update(invoices).set({ deletedAt: new Date() }).where(eq(invoices.id, id));
  await audit(db, { actor, action: 'invoice.discarded', subjectType: 'invoice', subjectId: id, detail: { number: invoice.number } });
}

/**
 * Emite la factura en Stripe. Si Stripe no responde, la factura queda en borrador y no se envía nada.
 * Sin correo de facturación no se emite: Stripe no tendría a dónde enviarla.
 */
export async function issueInvoice(db: Db, billing: BillingGateway, id: string, actor: string): Promise<Invoice> {
  const invoice = await findInvoice(db, id);
  requireDraft(invoice, 'Solo se emite un borrador.');

  const [organization] = await db.select().from(organizations).where(eq(organizations.id, invoice.organizationId));
  // Stripe envía la factura al correo del cliente: el de esta factura, o el de facturación de la organización.
  const recipient = invoice.recipientEmail ?? organization!.billingEmail;
  if (!recipient) {
    throw new ServiceError(409, 'missing_billing_email', 'Escribe el correo al que se envía la factura antes de emitirla.');
  }
  const recipientChanged = recipient !== organization!.billingEmail;
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(asc(invoiceLines.position));

  let customerId = organization!.stripeCustomerId;
  try {
    if (!customerId) {
      const customer = await billing.createCustomer({
        name: organization!.name,
        email: recipient,
        metadata: { arkanium_organization_id: organization!.id },
      });
      customerId = customer.id;
      await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, organization!.id));
    } else if (recipientChanged) {
      // Stripe no tiene destinatario por factura: el correo del cliente pasa a ser este.
      await billing.updateCustomerEmail(customerId, recipient);
    }

    const created = await billing.createInvoice({
      customerId,
      lines: lines.map(({ description, quantity, unitAmountCents }) => ({ description, quantity, unitAmountCents })),
      currency: invoice.currency,
      description: invoice.concept,
      daysUntilDue: invoice.dueDays,
      metadata: { arkanium_invoice_id: invoice.id, arkanium_number: invoice.number },
    });

    // La factura ya existe en Stripe: el correo de facturación de la organización queda como este.
    if (recipientChanged) {
      await db.update(organizations).set({ billingEmail: recipient }).where(eq(organizations.id, organization!.id));
    }
    const [updated] = await db
      .update(invoices)
      .set({ status: 'enviada', stripeInvoiceId: created.id, hostedUrl: created.hostedUrl, issuedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    await audit(db, { actor, action: 'invoice.issued', subjectType: 'invoice', subjectId: id, detail: { stripeInvoiceId: created.id } });
    return updated!;
  } catch (error) {
    if (error instanceof BillingError) {
      await audit(db, { actor, action: 'invoice.issue_failed', subjectType: 'invoice', subjectId: id, detail: { reason: error.message } });
      throw new ServiceError(502, 'billing_unavailable', 'Stripe no respondió. La factura sigue en borrador; intenta de nuevo.');
    }
    throw error;
  }
}

/** Reenvía una factura emitida y todavía no pagada. Sirve de recordatorio cuando ya venció. */
export async function sendReminder(db: Db, billing: BillingGateway, id: string, actor: string): Promise<Invoice> {
  const invoice = await findInvoice(db, id);
  if (invoice.status !== 'enviada' || !invoice.stripeInvoiceId) {
    throw new ServiceError(409, 'invalid_state', 'Solo se recuerda una factura enviada y sin pagar.');
  }
  try {
    await billing.sendInvoice(invoice.stripeInvoiceId);
  } catch (error) {
    if (error instanceof BillingError) throw new ServiceError(502, 'billing_unavailable', 'Stripe no respondió. No se envió el recordatorio.');
    throw error;
  }
  await audit(db, { actor, action: 'invoice.reminder_sent', subjectType: 'invoice', subjectId: id, detail: {} });
  return invoice;
}

/** Anula una factura. Si ya se envió, se anula también en Stripe. Nunca se borra. */
export async function voidInvoice(db: Db, billing: BillingGateway, id: string, actor: string): Promise<Invoice> {
  const invoice = await findInvoice(db, id);
  if (invoice.status === 'anulada') throw new ServiceError(409, 'invalid_state', 'La factura ya está anulada.');
  if (invoice.status === 'pagada') throw new ServiceError(409, 'invalid_state', 'Una factura pagada no se anula; se emite una nota de crédito.');

  if (invoice.status === 'enviada' && invoice.stripeInvoiceId) {
    try {
      await billing.voidInvoice(invoice.stripeInvoiceId);
    } catch (error) {
      if (error instanceof BillingError) throw new ServiceError(502, 'billing_unavailable', 'Stripe no respondió. La factura no se anuló.');
      throw error;
    }
  }
  const [updated] = await db.update(invoices).set({ status: 'anulada' }).where(eq(invoices.id, id)).returning();
  await audit(db, { actor, action: 'invoice.voided', subjectType: 'invoice', subjectId: id, detail: {} });
  return updated!;
}

/**
 * Nota de crédito sobre una factura pagada: devuelve el monto al cliente desde Stripe.
 * Se pueden hacer varias, siempre que sumen como máximo el total de la factura.
 */
export async function createCreditNote(db: Db, billing: BillingGateway, id: string, input: CreditNote, actor: string) {
  const invoice = await findInvoice(db, id);
  if (invoice.status !== 'pagada' || !invoice.stripeInvoiceId) {
    throw new ServiceError(409, 'invalid_state', 'La nota de crédito es para facturas pagadas. Una factura sin pagar se anula.');
  }
  const [credited] = await db
    .select({ total: sql<number>`coalesce(sum(${invoiceCreditNotes.amountCents}), 0)::int` })
    .from(invoiceCreditNotes)
    .where(eq(invoiceCreditNotes.invoiceId, id));
  const remaining = invoice.amountCents - (credited?.total ?? 0);
  if (input.amountCents > remaining) {
    throw new ServiceError(409, 'invalid_state', `La nota de crédito supera lo pendiente de devolver (${remaining} centavos).`);
  }

  let stripeCreditNoteId: string;
  try {
    ({ id: stripeCreditNoteId } = await billing.createCreditNote({
      stripeInvoiceId: invoice.stripeInvoiceId,
      amountCents: input.amountCents,
      description: input.reason,
      refund: true,
    }));
  } catch (error) {
    if (error instanceof BillingError) throw new ServiceError(502, 'billing_unavailable', 'Stripe no respondió. La nota de crédito no se creó.');
    throw error;
  }
  const [note] = await db
    .insert(invoiceCreditNotes)
    .values({ invoiceId: id, amountCents: input.amountCents, reason: input.reason, stripeCreditNoteId })
    .returning();
  await audit(db, { actor, action: 'invoice.credit_note', subjectType: 'invoice', subjectId: id, detail: { amountCents: input.amountCents, stripeCreditNoteId } });
  return note!;
}

/** Cambia el correo de facturación. Si el cliente ya existe en Stripe, se actualiza allí primero. */
export async function updateBillingEmail(db: Db, billing: BillingGateway | undefined, organizationId: string, billingEmail: string | null, actor: string) {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!organization) throw new ServiceError(404, 'not_found', 'Cliente no encontrado.');
  if (organization.stripeCustomerId && billing) {
    try {
      await billing.updateCustomerEmail(organization.stripeCustomerId, billingEmail);
    } catch (error) {
      if (error instanceof BillingError) throw new ServiceError(502, 'billing_unavailable', 'Stripe no respondió. El correo no se cambió.');
      throw error;
    }
  }
  const [updated] = await db.update(organizations).set({ billingEmail }).where(eq(organizations.id, organizationId)).returning();
  await audit(db, { actor, action: 'organization.billing_email_changed', subjectType: 'organization', subjectId: organizationId, detail: { set: billingEmail !== null } });
  return updated!;
}

/** Webhook invoice.paid de Stripe. Idempotente: pagar dos veces no cambia nada. */
export async function markPaidFromStripe(db: Db, stripeInvoiceId: string, paidAt: Date): Promise<Invoice | null> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
  if (!invoice) return null;
  if (invoice.status === 'pagada') return invoice;
  const [updated] = await db.update(invoices).set({ status: 'pagada', paidAt }).where(eq(invoices.id, invoice.id)).returning();
  await audit(db, { actor: 'stripe', action: 'invoice.paid', subjectType: 'invoice', subjectId: invoice.id, detail: { stripeInvoiceId } });
  return updated!;
}

export async function listInvoices(db: Db, organizationId: string): Promise<Invoice[]> {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.createdAt));
}

/** Vista del cliente. La página de pago solo la ve un administrador de la organización. */
export function clientInvoiceView(invoice: Invoice, canPay: boolean) {
  const payable = canPay && invoice.status === 'enviada';
  return {
    id: invoice.id,
    number: invoice.number,
    concept: invoice.concept,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    status: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    payUrl: payable ? invoice.hostedUrl : null,
  };
}

/** Core: todas las facturas activas con su cliente, proyecto, líneas y notas de crédito; la más reciente primero. */
export async function listAllInvoices(db: Db) {
  const rows = await db
    .select({ invoice: invoices, orgName: organizations.name, projectName: projects.name })
    .from(invoices)
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(isNull(invoices.deletedAt))
    .orderBy(desc(invoices.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.invoice.id);
  const lines = await db.select().from(invoiceLines).where(inArray(invoiceLines.invoiceId, ids)).orderBy(asc(invoiceLines.position));
  const credits = await db
    .select({ invoiceId: invoiceCreditNotes.invoiceId, total: sql<number>`sum(${invoiceCreditNotes.amountCents})::int` })
    .from(invoiceCreditNotes)
    .where(inArray(invoiceCreditNotes.invoiceId, ids))
    .groupBy(invoiceCreditNotes.invoiceId);

  return rows.map(({ invoice, orgName, projectName }) => ({
    ...clientInvoiceView(invoice, true),
    organizationId: invoice.organizationId,
    projectId: invoice.projectId,
    recipientEmail: invoice.recipientEmail,
    clientName: orgName,
    projectName: projectName ?? null,
    dueDays: invoice.dueDays,
    dueAt: invoice.issuedAt ? new Date(invoice.issuedAt.getTime() + invoice.dueDays * 86_400_000).toISOString() : null,
    hostedUrl: invoice.hostedUrl,
    lines: lines
      .filter((line) => line.invoiceId === invoice.id)
      .map(({ description, quantity, unitAmountCents }) => ({ description, quantity, unitAmountCents })),
    creditedCents: credits.find((credit) => credit.invoiceId === invoice.id)?.total ?? 0,
  }));
}
