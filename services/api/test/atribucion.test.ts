import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { auditLog, campaigns, contacts, decisions, invoiceCreditNotes, invoiceLines, invoices, landingPages, leads, meetings, organizations, personaContacts, projects, proposalVersions, proposals, buyerPersonas } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;
const INTAKE = 'token-sitio-atribucion';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(personaContacts);
  await db.delete(landingPages);
  await db.delete(invoiceCreditNotes);
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(campaigns);
  await db.delete(buyerPersonas);
  await db.delete(organizations);
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db, leadIntakeToken: INTAKE });
});

const intake = { name: 'Ana Pérez', email: 'ana@ejemplo.test', priority: 'unsure', locale: 'es', source: 'linkedin', consent: { accepted: true, textVersion: "2026-10" } };

describe('atribución de leads a campañas', () => {
  it('un lead que llega desde una landing queda asociado a su campaña', async () => {
    const [campaign] = await db.insert(campaigns).values({ name: 'Modernización ERP', service: 'Diagnóstico', createdBy: 'owner' }).returning();
    const response = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${INTAKE}` },
      payload: { ...intake, campaignId: campaign!.id },
    });
    expect(response.statusCode).toBe(201);

    const [lead] = await db.select().from(leads).where(eq(leads.id, response.json().id));
    expect(lead!.campaignId).toBe(campaign!.id);
  });

  it('una campaña inexistente no rechaza al lead: se guarda sin campaña', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${INTAKE}` },
      payload: { ...intake, campaignId: '00000000-0000-4000-8000-000000000000' },
    });
    expect(response.statusCode).toBe(201);
    const [lead] = await db.select().from(leads).where(eq(leads.id, response.json().id));
    expect(lead!.campaignId).toBeNull();
  });

  it('una campaña borrada tampoco cuenta', async () => {
    const [campaign] = await db
      .insert(campaigns)
      .values({ name: 'Vieja', service: 'Diagnóstico', createdBy: 'owner', deletedAt: new Date() })
      .returning();
    const response = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${INTAKE}` },
      payload: { ...intake, campaignId: campaign!.id },
    });
    const [lead] = await db.select().from(leads).where(eq(leads.id, response.json().id));
    expect(lead!.campaignId).toBeNull();
  });
});
