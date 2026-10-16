/**
 * F-10 y A-06: facturas. El owner redacta y emite desde core; el cliente ve su factura y paga en la
 * página segura de Stripe. Ningún agente emite ni cobra: toda emisión la aprueba el owner.
 */
import { desc, eq, sql } from 'drizzle-orm';
import { audit } from '../audit.js';
import type { Db } from '../db/client.js';
import { invoices, organizations } from '../db/schema.js';
import { ServiceError } from '../errors.js';
import type { BillingGateway } from './stripe.js';
import { BillingError } from './stripe.js';
import type { InvoiceDraft } from '@arkanium/contracts';

export type Invoice = typeof invoices.$inferSelect;

export async function findInvoice(db: Db, id: string): Promise<Invoice> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!invoice) throw new ServiceError(404, 'not_found', 'Factura no encontrada.');
  return invoice;
}

/** Numeración F-AAAA-NNNN, consecutiva por año. */
async function nextNumber(db: Db): Promise<string> {
  const year = new Date().getUTCFullYear();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(invoices);
  return `F-${year}-${String((row?.count ?? 0) + 1).padStart(4, '0')}`;
}

export async function createDraft(db: Db, organizationId: string, input: InvoiceDraft, actor: string): Promise<Invoice> {
  const number = await nextNumber(db);
  const [invoice] = await db
    .insert(invoices)
    .values({
      organizationId,
      projectId: input.projectId ?? null,
      number,
      concept: input.concept,
      amountCents: input.amountCents,
      dueDays: input.dueDays,
    })
    .returning();
  await audit(db, { actor, action: 'invoice.drafted', subjectType: 'invoice', subjectId: invoice!.id, detail: { number, amountCents: input.amountCents } });
  return invoice!;
}

/**
 * Emite la factura en Stripe. Si Stripe no responde, la factura queda en borrador y no se envía nada.
 */
export async function issueInvoice(db: Db, billing: BillingGateway, id: string, actor: string): Promise<Invoice> {
  const invoice = await findInvoice(db, id);
  if (invoice.status !== 'borrador') throw new ServiceError(409, 'invalid_state', 'Solo se emite un borrador.');

  const [organization] = await db.select().from(organizations).where(eq(organizations.id, invoice.organizationId));
  let customerId = organization!.stripeCustomerId;
  try {
    if (!customerId) {
      const customer = await billing.createCustomer({
        name: organization!.name,
        email: organization!.billingEmail,
        metadata: { arkanium_organization_id: organization!.id },
      });
      customerId = customer.id;
      await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, organization!.id));
    }

    const created = await billing.createInvoice({
      customerId,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      description: invoice.concept,
      daysUntilDue: invoice.dueDays,
      metadata: { arkanium_invoice_id: invoice.id, arkanium_number: invoice.number },
    });

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

/** Anula una factura. Si ya se envió, se anula también en Stripe. Nunca se borra. */
export async function voidInvoice(db: Db, billing: BillingGateway, id: string, actor: string): Promise<Invoice> {
  const invoice = await findInvoice(db, id);
  if (invoice.status === 'anulada') throw new ServiceError(409, 'invalid_state', 'La factura ya está anulada.');
  if (invoice.status === 'pagada') throw new ServiceError(409, 'invalid_state', 'Una factura pagada no se anula; se reembolsa desde Stripe.');

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
  return db.select().from(invoices).where(eq(invoices.organizationId, organizationId)).orderBy(desc(invoices.createdAt));
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
