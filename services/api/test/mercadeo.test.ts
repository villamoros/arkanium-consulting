import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import {
  articles,
  auditLog,
  buyerPersonas,
  campaignChannels,
  campaigns,
  contacts,
  decisions,
  invoiceCreditNotes,
  invoiceLines,
  invoices,
  landingPages,
  leads,
  meetings,
  organizations,
  personaContacts,
  projects,
  proposalVersions,
  proposals,
} from '../src/db/schema.js';
import { bogotaDayStart } from '../src/marketing/service.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;

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
  await db.delete(articles);
  await db.delete(invoiceCreditNotes);
  await db.delete(invoiceLines);
  await db.delete(invoices);
  await db.delete(proposalVersions);
  await db.delete(proposals);
  await db.delete(meetings);
  await db.delete(projects);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(campaignChannels);
  await db.delete(campaigns);
  await db.delete(buyerPersonas);
  await db.delete(organizations);
  await db.insert(organizations).values({ name: 'Cliente mercadeo', kind: 'client', clerkOrgId: CLIENT });
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

async function persona(overrides: Record<string, unknown> = {}) {
  const response = await call('POST', '/buyer-personas', 'token-owner', {
    name: 'Director de operaciones',
    segment: 'Manufactura de tamaño medio',
    service: 'Evaluación de arquitectura',
    channel: 'linkedin',
    ...overrides,
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe('campañas y landing pages', () => {
  it('se crean campañas y landings, y una landing puede pertenecer a una campaña', async () => {
    const created = await call('POST', '/campaigns', 'token-owner', { name: 'Modernización ERP', service: 'Diagnóstico' });
    expect(created.statusCode).toBe(201);
    const campaignId = created.json().id as string;

    const landing = await call('POST', '/landing-pages', 'token-owner', { title: 'Diagnóstico de arquitectura', campaignId });
    expect(landing.statusCode).toBe(201);

    const list = await call('GET', '/campaigns', 'token-owner');
    expect(list.json().campaigns[0]).toMatchObject({ name: 'Modernización ERP', status: 'borrador', leads: 0 });
    expect(list.json().campaigns[0].landings).toEqual([expect.objectContaining({ title: 'Diagnóstico de arquitectura' })]);
  });

  it('una campaña cambia de estado y queda en la bitácora', async () => {
    const created = await call('POST', '/campaigns', 'token-owner', { name: 'CTO fraccional', service: 'CTO fraccional' });
    const updated = await call('PATCH', `/campaigns/${created.json().id}`, 'token-owner', { status: 'pausada' });
    expect(updated.json().status).toBe('pausada');
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'campaign.updated')).toBe(true);
  });

  it('solo el owner gestiona mercadeo', async () => {
    expect((await call('GET', '/campaigns', 'token-client')).statusCode).toBe(403);
    expect((await call('POST', '/buyer-personas', 'token-client', {})).statusCode).toBe(403);
  });
});

describe('buyer personas y límite diario', () => {
  it('un perfil se crea y su estado se pausa y reanuda', async () => {
    const id = await persona();
    const paused = await call('PATCH', `/buyer-personas/${id}`, 'token-owner', { status: 'pausado' });
    expect(paused.json().status).toBe('pausado');
    const actions = (await db.select().from(auditLog)).map((e) => e.action);
    expect(actions).toContain('persona.paused');
  });

  it('se registran hasta 10 contactos por día en total; el undécimo se rechaza', async () => {
    const id = await persona();
    for (let i = 0; i < 10; i += 1) {
      const response = await call('POST', `/buyer-personas/${id}/contacts`, 'token-owner', { channel: 'linkedin', note: `Contacto ${i + 1}` });
      expect(response.statusCode).toBe(201);
    }
    const refused = await call('POST', `/buyer-personas/${id}/contacts`, 'token-owner', { channel: 'linkedin', note: 'Extra' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toMatch(/Límite diario/);

    const overview = await call('GET', '/buyer-personas', 'token-owner');
    expect(overview.json()).toMatchObject({ cap: 10, totalToday: 10 });
    expect(overview.json().personas[0].contactsToday).toBe(10);
  });

  it('los contactos de días anteriores no cuentan para hoy', async () => {
    const id = await persona();
    const yesterday = new Date(bogotaDayStart(new Date()).getTime() - 60_000);
    await db.insert(personaContacts).values(
      Array.from({ length: 10 }, (_, i) => ({ personaId: id, channel: 'linkedin', note: `Antiguo ${i}`, actor: 'owner', occurredAt: yesterday })),
    );
    const response = await call('POST', `/buyer-personas/${id}/contacts`, 'token-owner', { channel: 'linkedin', note: 'Hoy' });
    expect(response.statusCode).toBe(201);
  });

  it('un perfil pausado no recibe contactos', async () => {
    const id = await persona({ status: undefined });
    await call('PATCH', `/buyer-personas/${id}`, 'token-owner', { status: 'pausado' });
    const response = await call('POST', `/buyer-personas/${id}/contacts`, 'token-owner', { channel: 'linkedin', note: 'Prueba' });
    expect(response.statusCode).toBe(409);
  });

  it('pasar un perfil a Leads crea el lead con el origen del perfil y lo vincula a él', async () => {
    const id = await persona();
    const converted = await call('POST', `/buyer-personas/${id}/convert`, 'token-owner', { name: 'Ana Pérez', email: 'ana@ejemplo.test' });
    expect(converted.statusCode).toBe(201);

    const [lead] = await db.select().from(leads).where(eq(leads.id, converted.json().leadId));
    expect(lead).toMatchObject({ source: 'linkedin', sourceReference: 'Director de operaciones', buyerPersonaId: id });
  });
});

describe('artículos de Insights', () => {
  async function article(overrides: Record<string, unknown> = {}) {
    const response = await call('POST', '/articles', 'token-owner', {
      title: 'Escalar un SaaS antes de añadir servidores',
      langs: ['es', 'en'],
      ...overrides,
    });
    expect(response.statusCode).toBe(201);
    return response.json().id as string;
  }

  /** Escribe el cuerpo en cada idioma del artículo, como lo haría el editor. */
  async function withContent(id: string) {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto del artículo' }] }] };
    const response = await call('PATCH', `/articles/${id}`, 'token-owner', {
      content: { es: { title: 'Título', body }, en: { title: 'Title', body } },
    });
    expect(response.statusCode).toBe(200);
  }

  it('un artículo sin resumen ni caso no pasa a revisión', async () => {
    const id = await article();
    expect((await call('POST', `/articles/${id}/review`, 'token-owner')).statusCode).toBe(409);
  });

  it('el flujo es borrador, revisión y publicación; la publicación aparece en Aprobaciones', async () => {
    const id = await article({ excerpt: 'Qué medir antes de comprar más infraestructura.', caseRef: 'Escalabilidad SaaS (caso representativo)' });
    await withContent(id);
    expect((await call('POST', `/articles/${id}/review`, 'token-owner')).json().status).toBe('en_revision');

    const approvals = await call('GET', '/approvals', 'token-owner');
    expect(approvals.json().approvals).toEqual([
      expect.objectContaining({ action: 'publicar_articulo', module: 'Insights', approvable: true, subjectId: id }),
    ]);

    const published = await call('POST', `/articles/${id}/publish`, 'token-owner');
    expect(published.json()).toMatchObject({ status: 'publicado' });
    expect((await call('GET', '/approvals', 'token-owner')).json().approvals).toEqual([]);
  });

  it('un artículo publicado no se edita, y editar uno en revisión lo devuelve a borrador', async () => {
    const id = await article({ excerpt: 'Resumen', caseRef: 'Caso' });
    await withContent(id);
    await call('POST', `/articles/${id}/review`, 'token-owner');
    const edited = await call('PATCH', `/articles/${id}`, 'token-owner', { title: 'Nuevo título' });
    expect(edited.json().status).toBe('borrador');

    await call('POST', `/articles/${id}/review`, 'token-owner');
    await call('POST', `/articles/${id}/publish`, 'token-owner');
    expect((await call('PATCH', `/articles/${id}`, 'token-owner', { title: 'Otro' })).statusCode).toBe(409);
  });

  it('solo un borrador se descarta', async () => {
    const id = await article();
    expect((await call('DELETE', `/articles/${id}`, 'token-owner')).statusCode).toBe(204);
    expect((await call('GET', '/articles', 'token-owner')).json().articles).toEqual([]);
  });
});
