import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { BillingGateway } from '../src/billing/stripe.js';
import type { Db } from '../src/db/client.js';
import { auditLog, contacts, decisions, invoiceCreditNotes, invoiceLines, invoices, meetings, organizations, proposalVersions, proposals, projects } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
let orgId: string;
let calls: Array<{ method: string; args: unknown[] }>;

/** Stripe de prueba: responde ids predecibles y registra las llamadas. */
function fakeBilling(): BillingGateway {
  let count = 0;
  const record = (method: string, args: unknown[]) => calls.push({ method, args });
  return {
    async createCustomer(input) {
      record('createCustomer', [input]);
      return { id: 'cus_prueba' };
    },
    async updateCustomerEmail(customerId, email) {
      record('updateCustomerEmail', [customerId, email]);
    },
    async createInvoice(input) {
      record('createInvoice', [input]);
      count += 1;
      return { id: `in_prueba_${count}`, hostedUrl: `https://invoice.stripe.test/in_prueba_${count}` };
    },
    async voidInvoice(id) {
      record('voidInvoice', [id]);
    },
    async sendInvoice(id) {
      record('sendInvoice', [id]);
    },
    async createCreditNote(input) {
      record('createCreditNote', [input]);
      return { id: `cn_prueba_${calls.length}` };
    },
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  calls = [];
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(invoiceCreditNotes);
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(organizations);
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Cliente facturación', kind: 'client', clerkOrgId: CLIENT, billingEmail: 'pagos@cliente.test' })
    .returning();
  orgId = org!.id;
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, billing: fakeBilling() });
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

const lines = [
  { description: 'Hito 1: diagnóstico', quantity: 1, unitAmountCents: 60000 },
  { description: 'Horas de soporte', quantity: 3, unitAmountCents: 10000 },
];

async function draft(concept = 'Anticipo 20%', draftLines = lines) {
  const response = await call('POST', `/organizations/${orgId}/invoices`, 'token-owner', { concept, lines: draftLines, dueDays: 30 });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

async function issued() {
  const id = await draft();
  const response = await call('POST', `/invoices/${id}/issue`, 'token-owner');
  expect(response.statusCode).toBe(200);
  return id;
}

async function markPaid(id: string) {
  await db.update(invoices).set({ status: 'pagada', paidAt: new Date() }).where(eq(invoices.id, id));
}

describe('facturas en Core', () => {
  it('el borrador nace con número, líneas y total, y aparece en el listado del owner con su cliente', async () => {
    const id = await draft();
    const list = await call('GET', '/invoices', 'token-owner');
    expect(list.statusCode).toBe(200);
    expect(list.json().invoices[0]).toMatchObject({
      id,
      status: 'borrador',
      clientName: 'Cliente facturación',
      amountCents: 60000 + 3 * 10000,
      lines,
      creditedCents: 0,
    });
    expect(list.json().invoices[0].number).toBeTruthy();
    expect((await call('GET', '/invoices', 'token-client')).statusCode).toBe(403);
  });

  it('un borrador se espera en Aprobaciones para emitirse, y al emitirlo sale de la cola', async () => {
    const id = await draft();
    const before = await call('GET', '/approvals', 'token-owner');
    expect(before.json().approvals).toEqual([
      expect.objectContaining({ action: 'emitir_factura', approvable: true, module: 'Cobros y facturas', subjectId: id }),
    ]);

    const issuedResponse = await call('POST', `/invoices/${id}/issue`, 'token-owner');
    expect(issuedResponse.statusCode).toBe(200);
    expect(issuedResponse.json()).toMatchObject({ status: 'enviada' });

    const after = await call('GET', '/approvals', 'token-owner');
    expect(after.json().approvals).toEqual([]);
  });

  it('la factura se crea en Stripe con cada línea y el correo de facturación del cliente', async () => {
    const id = await draft();
    await call('POST', `/invoices/${id}/issue`, 'token-owner');
    const create = calls.find((call) => call.method === 'createCustomer');
    expect(create?.args[0]).toMatchObject({ email: 'pagos@cliente.test' });
    const invoice = calls.find((call) => call.method === 'createInvoice');
    expect(invoice?.args[0]).toMatchObject({ lines, daysUntilDue: 30 });
  });

  it('no se emite sin correo de facturación del cliente', async () => {
    const [bare] = await db.insert(organizations).values({ name: 'Sin correo', kind: 'client', clerkOrgId: 'org_sin_correo' }).returning();
    const response = await call('POST', `/organizations/${bare!.id}/invoices`, 'token-owner', { concept: 'Hito', lines, dueDays: 30 });
    const id = response.json().id as string;
    const issuedResponse = await call('POST', `/invoices/${id}/issue`, 'token-owner');
    expect(issuedResponse.statusCode).toBe(409);
    expect(issuedResponse.json().error).toBe('missing_billing_email');
    expect(calls.find((call) => call.method === 'createInvoice')).toBeUndefined();
  });

  it('anular una factura emitida la deja anulada', async () => {
    const id = await issued();
    const voided = await call('POST', `/invoices/${id}/void`, 'token-owner');
    expect(voided.statusCode).toBe(200);
    expect(voided.json().status).toBe('anulada');
  });

  it('un borrador se corrige: cambian sus líneas y su total, y una factura emitida no se edita', async () => {
    const id = await draft();
    const updated = await call('PUT', `/invoices/${id}`, 'token-owner', {
      concept: 'Anticipo 30%',
      lines: [{ description: 'Anticipo', quantity: 1, unitAmountCents: 120000 }],
      dueDays: 15,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ concept: 'Anticipo 30%', amountCents: 120000 });

    const list = await call('GET', '/invoices', 'token-owner');
    expect(list.json().invoices[0]).toMatchObject({ dueDays: 15, lines: [{ description: 'Anticipo', quantity: 1, unitAmountCents: 120000 }] });

    const emitted = await issued();
    const refused = await call('PUT', `/invoices/${emitted}`, 'token-owner', { concept: 'Cambio', lines, dueDays: 30 });
    expect(refused.statusCode).toBe(409);
  });

  it('un borrador se descarta: desaparece de la lista y de Aprobaciones, y una factura emitida no se descarta', async () => {
    const id = await draft();
    const discarded = await call('DELETE', `/invoices/${id}`, 'token-owner');
    expect(discarded.statusCode).toBe(204);

    expect((await call('GET', '/invoices', 'token-owner')).json().invoices).toEqual([]);
    expect((await call('GET', '/approvals', 'token-owner')).json().approvals).toEqual([]);

    const emitted = await issued();
    expect((await call('DELETE', `/invoices/${emitted}`, 'token-owner')).statusCode).toBe(409);
  });

  it('el correo de facturación se cambia solo al owner y se sincroniza con Stripe', async () => {
    const forbidden = await call('PATCH', `/organizations/${orgId}/billing-email`, 'token-client', { billingEmail: 'otro@cliente.test' });
    expect(forbidden.statusCode).toBe(403);

    const changed = await call('PATCH', `/organizations/${orgId}/billing-email`, 'token-owner', { billingEmail: 'Facturas@Cliente.test' });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().billingEmail).toBe('facturas@cliente.test');

    // Con cliente ya creado en Stripe, el correo nuevo se actualiza allí.
    await db.update(organizations).set({ stripeCustomerId: 'cus_existente' }).where(eq(organizations.id, orgId));
    await call('PATCH', `/organizations/${orgId}/billing-email`, 'token-owner', { billingEmail: 'nuevo@cliente.test' });
    expect(calls.find((call) => call.method === 'updateCustomerEmail')?.args).toEqual(['cus_existente', 'nuevo@cliente.test']);

    const cleared = await call('PATCH', `/organizations/${orgId}/billing-email`, 'token-owner', { billingEmail: '' });
    expect(cleared.json().billingEmail).toBeNull();
  });

  it('el recordatorio reenvía solo una factura enviada y sin pagar', async () => {
    const id = await draft();
    expect((await call('POST', `/invoices/${id}/reminder`, 'token-owner')).statusCode).toBe(409);

    const emitted = await issued();
    const reminded = await call('POST', `/invoices/${emitted}/reminder`, 'token-owner');
    expect(reminded.statusCode).toBe(200);
    expect(calls.find((call) => call.method === 'sendInvoice')?.args).toEqual(['in_prueba_1']);
  });

  it('una nota de crédito solo va sobre una factura pagada y no pasa de lo pendiente', async () => {
    const emitted = await issued();
    const notPaid = await call('POST', `/invoices/${emitted}/credit-notes`, 'token-owner', { amountCents: 1000, reason: 'Ajuste' });
    expect(notPaid.statusCode).toBe(409);

    await markPaid(emitted);
    const total = 60000 + 3 * 10000;
    const first = await call('POST', `/invoices/${emitted}/credit-notes`, 'token-owner', { amountCents: 20000, reason: 'Horas no prestadas' });
    expect(first.statusCode).toBe(201);
    expect(calls.find((call) => call.method === 'createCreditNote')?.args[0]).toMatchObject({ amountCents: 20000, refund: true });

    const over = await call('POST', `/invoices/${emitted}/credit-notes`, 'token-owner', { amountCents: total, reason: 'Exceso' });
    expect(over.statusCode).toBe(409);

    const list = await call('GET', '/invoices', 'token-owner');
    expect(list.json().invoices[0]).toMatchObject({ status: 'pagada', creditedCents: 20000 });
  });

  it('el correo de envío de la factura se usa en Stripe y pasa a ser el de facturación del cliente', async () => {
    const [bare] = await db.insert(organizations).values({ name: 'Sin correo', kind: 'client', clerkOrgId: 'org_correo_factura' }).returning();
    const response = await call('POST', `/organizations/${bare!.id}/invoices`, 'token-owner', {
      concept: 'Hito 1',
      lines,
      dueDays: 30,
      recipientEmail: 'Compras@Cliente.test',
    });
    expect(response.json().id).toBeTruthy();
    expect((await call('POST', `/invoices/${response.json().id}/issue`, 'token-owner')).statusCode).toBe(200);
    expect(calls.find((call) => call.method === 'createCustomer')?.args[0]).toMatchObject({ email: 'compras@cliente.test' });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, bare!.id));
    expect(org!.billingEmail).toBe('compras@cliente.test');
  });

  it('con cliente ya creado en Stripe, un correo distinto para una factura actualiza el correo del cliente', async () => {
    await db.update(organizations).set({ stripeCustomerId: 'cus_existente' }).where(eq(organizations.id, orgId));
    const response = await call('POST', `/organizations/${orgId}/invoices`, 'token-owner', { concept: 'Hito', lines, dueDays: 30, recipientEmail: 'nuevo@cliente.test' });
    await call('POST', `/invoices/${response.json().id}/issue`, 'token-owner');
    expect(calls.find((call) => call.method === 'updateCustomerEmail')?.args).toEqual(['cus_existente', 'nuevo@cliente.test']);
  });
});
