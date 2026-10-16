import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { BillingGateway } from '../src/billing/stripe.js';
import type { Db } from '../src/db/client.js';
import {
  approvals,
  auditLog,
  contacts,
  corrections,
  decisions,
  deliverables,
  invoices,
  leads,
  meetings,
  milestones,
  organizations,
  projects,
} from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, OTHER_CLIENT, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let identity: ReturnType<typeof fakeIdentity>;
let billing: ReturnType<typeof fakeBilling>;
let app: ReturnType<typeof buildApp>;
let clientOrgId: string;
let otherOrgId: string;
let projectId: string;

const WEBHOOK_SECRET = 'whsec_prueba';

/** Doble de Stripe: registra las llamadas y devuelve ids predecibles. Puede fallar a propósito. */
function fakeBilling() {
  const calls: Array<{ op: string; input?: unknown }> = [];
  let failNext = false;
  const gateway: BillingGateway & { calls: typeof calls; failNext: () => void } = {
    calls,
    failNext: () => {
      failNext = true;
    },
    async createCustomer(input) {
      calls.push({ op: 'createCustomer', input });
      return { id: 'cus_test' };
    },
    async createInvoice(input) {
      if (failNext) {
        failNext = false;
        const { BillingError } = await import('../src/billing/stripe.js');
        throw new BillingError('caída simulada');
      }
      calls.push({ op: 'createInvoice', input });
      return { id: `in_${calls.length}`, hostedUrl: `https://invoice.stripe.test/in_${calls.length}` };
    },
    async voidInvoice(id) {
      calls.push({ op: 'voidInvoice', input: id });
    },
  };
  return gateway;
}

function signed(body: object, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return { raw, header: `t=${timestamp},v1=${v1}` };
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(decisions);
  await db.delete(invoices);
  await db.delete(corrections);
  await db.delete(meetings);
  await db.delete(deliverables);
  await db.delete(milestones);
  await db.delete(projects);
  await db.delete(approvals);
  await db.delete(contacts);
  await db.delete(leads);
  await db.delete(organizations);

  const [client] = await db.insert(organizations).values({ name: 'Empresa Demo', kind: 'client', clerkOrgId: CLIENT, billingEmail: 'pagos@empresa.test' }).returning();
  const [other] = await db.insert(organizations).values({ name: 'Otro cliente', kind: 'client', clerkOrgId: OTHER_CLIENT }).returning();
  clientOrgId = client!.id;
  otherOrgId = other!.id;

  identity = fakeIdentity();
  billing = fakeBilling();
  app = buildApp({ identity, internalOrgId: INTERNAL, db, billing, stripeWebhookSecret: WEBHOOK_SECRET });

  const created = await call('POST', `/organizations/${clientOrgId}/projects`, 'token-owner', {
    name: 'Modernización ERP',
    serviceFamily: 'architecture',
    phase: 'evaluar',
    progress: 'Entrevistas completas',
    nextStep: 'Revisión del informe',
  });
  projectId = created.json().id;
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Sube un archivo y lo publica (camino feliz del owner). */
async function publishedDeliverable(title = 'Informe de hallazgos') {
  const created = await call('POST', `/projects/${projectId}/deliverables`, 'token-owner', { title });
  const id = created.json().id;
  await call('PUT', `/deliverables/${id}/content`, 'token-owner', {
    fileName: 'informe.pdf',
    mimeType: 'application/pdf',
    contentBase64: Buffer.from('%PDF-1.4 contenido de prueba').toString('base64'),
  });
  await call('POST', `/deliverables/${id}/publish`, 'token-owner');
  return id as string;
}

describe('F-05 proyectos e hitos', () => {
  it('el owner crea un proyecto y el cliente lo ve en su lista', async () => {
    const response = await call('GET', `/organizations/${clientOrgId}/projects`, 'token-client');
    expect(response.statusCode).toBe(200);
    expect(response.json().projects.map((p: { name: string }) => p.name)).toEqual(['Modernización ERP']);
  });

  it('un administrador de cliente no puede crear proyectos', async () => {
    const response = await call('POST', `/organizations/${clientOrgId}/projects`, 'token-client', { name: 'Intruso' });
    expect(response.statusCode).toBe(403);
  });

  it('cambiar la fecha prevista de un hito marca la fecha como cambiada para avisar al cliente (D-21)', async () => {
    const milestone = await call('POST', `/projects/${projectId}/milestones`, 'token-owner', { name: 'Arquitectura', plannedDate: '2026-10-28T12:00:00.000Z' });
    const id = milestone.json().id;

    await call('PATCH', `/milestones/${id}`, 'token-owner', { plannedDate: '2026-11-04T12:00:00.000Z' });
    const view = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(view.json().milestones[0].dateChanged).toBe(true);
  });

  it('el cliente no ve tareas internas: la vista del proyecto solo trae hitos, entregables, reuniones y facturas', async () => {
    const view = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(Object.keys(view.json()).sort()).toEqual(['deliverables', 'invoices', 'meetings', 'milestones', 'project']);
  });
});

describe('aislamiento entre clientes', () => {
  it('un cliente no ve proyectos de otra organización', async () => {
    const response = await call('GET', `/organizations/${clientOrgId}/projects`, 'token-other');
    expect(response.statusCode).toBe(403);
  });

  it('un cliente no puede abrir un proyecto ajeno', async () => {
    const response = await call('GET', `/projects/${projectId}`, 'token-other');
    expect(response.statusCode).toBe(403);
  });

  it('un miembro del equipo de Arkanium que no es owner no ve proyectos de clientes', async () => {
    const response = await call('GET', `/projects/${projectId}`, 'token-member');
    expect(response.statusCode).toBe(403);
  });
});

describe('F-08 entregables y descarga', () => {
  it('no se publica un entregable sin archivo', async () => {
    const created = await call('POST', `/projects/${projectId}/deliverables`, 'token-owner', { title: 'Sin archivo' });
    const response = await call('POST', `/deliverables/${created.json().id}/publish`, 'token-owner');
    expect(response.statusCode).toBe(409);
  });

  it('el cliente no puede descargar antes de la publicación', async () => {
    const created = await call('POST', `/projects/${projectId}/deliverables`, 'token-owner', { title: 'Borrador' });
    await call('PUT', `/deliverables/${created.json().id}/content`, 'token-owner', {
      fileName: 'borrador.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('x').toString('base64'),
    });
    const response = await call('GET', `/deliverables/${created.json().id}/file`, 'token-client-member');
    expect(response.statusCode).toBe(409);
  });

  it('el miembro descarga el archivo publicado, con su tipo, nombre y huella, y queda en la bitácora', async () => {
    const id = await publishedDeliverable();
    const response = await call('GET', `/deliverables/${id}/file`, 'token-client-member');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('informe.pdf');
    expect(response.body).toBe('%PDF-1.4 contenido de prueba');
    expect(response.headers['x-content-sha256']).toMatch(/^[a-f0-9]{64}$/);

    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'deliverable.downloaded' && e.actor === 'user_client_member')).toBe(true);
  });

  it('otra organización no puede descargar el entregable', async () => {
    const id = await publishedDeliverable();
    const response = await call('GET', `/deliverables/${id}/file`, 'token-other');
    expect(response.statusCode).toBe(403);
  });

  it('un archivo de más de 5 MB se rechaza', async () => {
    const created = await call('POST', `/projects/${projectId}/deliverables`, 'token-owner', { title: 'Grande' });
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString('base64');
    const response = await call('PUT', `/deliverables/${created.json().id}/content`, 'token-owner', {
      fileName: 'grande.bin',
      mimeType: 'application/octet-stream',
      contentBase64: big,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('A-02 aprobación y A-03 correcciones', () => {
  it('un miembro no puede aprobar: solo el administrador de la organización', async () => {
    const id = await publishedDeliverable();
    const response = await call('POST', `/deliverables/${id}/approve`, 'token-client-member', { text: 'Aprobado' });
    expect(response.statusCode).toBe(403);
  });

  it('el administrador aprueba con su texto exacto y queda en el registro de decisiones', async () => {
    const id = await publishedDeliverable();
    const response = await call('POST', `/deliverables/${id}/approve`, 'token-client', { text: 'Aprobado sin comentarios.' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('aprobado');

    const log = await call('GET', `/organizations/${clientOrgId}/decisions`, 'token-client-member');
    const [decision] = log.json().decisions;
    expect(decision.kind).toBe('aprobacion_entregable');
    expect(decision.text).toBe('Aprobado sin comentarios.');
    expect(decision.actorRole).toBe('org:admin');
    expect(decision.documentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('una corrección de un miembro pasa el entregable a correcciones y queda registrada; no se aplica sola', async () => {
    const id = await publishedDeliverable();
    const response = await call('POST', `/deliverables/${id}/corrections`, 'token-client-member', { text: 'Revisar la sección de riesgos.' });
    expect(response.statusCode).toBe(201);

    const view = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(view.json().deliverables[0].status).toBe('con_correcciones');
    expect(view.json().deliverables[0].openCorrections).toBe(1);

    const log = await call('GET', `/organizations/${clientOrgId}/decisions`, 'token-client');
    expect(log.json().decisions[0].kind).toBe('correccion');
  });

  it('no se aprueba un entregable con correcciones abiertas', async () => {
    const id = await publishedDeliverable();
    await call('POST', `/deliverables/${id}/corrections`, 'token-client-member', { text: 'Cambiar la cifra.' });
    const response = await call('POST', `/deliverables/${id}/approve`, 'token-client', { text: 'Aprobado' });
    expect(response.statusCode).toBe(409);
  });

  it('el owner atiende la corrección y el entregable vuelve a revisión interna', async () => {
    const id = await publishedDeliverable();
    const correction = await call('POST', `/deliverables/${id}/corrections`, 'token-client-member', { text: 'Cambiar la cifra.' });
    const resolved = await call('POST', `/corrections/${correction.json().id}/resolve`, 'token-owner', { note: 'Cifra corregida en la versión 2.' });
    expect(resolved.statusCode).toBe(200);

    const view = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(view.json().deliverables[0].status).toBe('en_revision');
  });
});

describe('F-03, A-04, F-09 y A-05 reuniones', () => {
  it('el cliente pide una reunión; el owner la confirma y publica el acta; el cliente la ve solo después', async () => {
    const requested = await call('POST', `/organizations/${clientOrgId}/meetings`, 'token-client-member', {
      topic: 'Revisión del informe',
      projectId,
      preferredWindows: ['martes 10:00'],
    });
    expect(requested.statusCode).toBe(201);
    const id = requested.json().id;

    const confirmed = await call('POST', `/meetings/${id}/confirm`, 'token-owner', { startsAt: '2026-10-21T16:00:00.000Z' });
    expect(confirmed.json().status).toBe('confirmada');

    const beforeMinutes = await call('GET', `/organizations/${clientOrgId}/meetings`, 'token-client');
    expect(beforeMinutes.json().meetings[0].minutesText).toBeNull();

    await call('POST', `/meetings/${id}/minutes`, 'token-owner', { text: 'Acuerdos: cerrar la frontera del módulo de facturación.' });
    const afterMinutes = await call('GET', `/organizations/${clientOrgId}/meetings`, 'token-client');
    expect(afterMinutes.json().meetings[0].minutesText).toContain('Acuerdos');
  });

  it('no se publica el acta de una reunión que aún no está confirmada', async () => {
    const requested = await call('POST', `/organizations/${clientOrgId}/meetings`, 'token-client', { topic: 'Avance' });
    const response = await call('POST', `/meetings/${requested.json().id}/minutes`, 'token-owner', { text: 'Acta' });
    expect(response.statusCode).toBe(409);
  });

  it('no se confirma dos veces la misma reunión', async () => {
    const requested = await call('POST', `/organizations/${clientOrgId}/meetings`, 'token-client', { topic: 'Avance' });
    const id = requested.json().id;
    await call('POST', `/meetings/${id}/confirm`, 'token-owner', { startsAt: '2026-10-21T16:00:00.000Z' });
    const again = await call('POST', `/meetings/${id}/confirm`, 'token-owner', { startsAt: '2026-10-22T16:00:00.000Z' });
    expect(again.statusCode).toBe(409);
  });
});

describe('F-10 y A-06 facturas', () => {
  async function draft(amountCents = 225000) {
    const response = await call('POST', `/organizations/${clientOrgId}/invoices`, 'token-owner', {
      projectId,
      concept: 'Anticipo 50% del diagnóstico',
      amountCents,
      dueDays: 15,
    });
    return response.json() as { id: string; number: string; status: string };
  }

  it('el owner redacta un borrador con número consecutivo y no se envía nada a Stripe todavía', async () => {
    const invoice = await draft();
    expect(invoice.status).toBe('borrador');
    expect(invoice.number).toMatch(/^F-\d{4}-0001$/);
    expect(billing.calls).toHaveLength(0);
  });

  it('al emitir, Stripe recibe el cliente y la factura; el cliente ve el estado y el administrador ve el enlace de pago', async () => {
    const invoice = await draft();
    const issued = await call('POST', `/invoices/${invoice.id}/issue`, 'token-owner');
    expect(issued.statusCode).toBe(200);
    expect(issued.json().status).toBe('enviada');
    expect(billing.calls.map((c) => c.op)).toEqual(['createCustomer', 'createInvoice']);

    const asAdmin = await call('GET', `/invoices/${invoice.id}`, 'token-client');
    expect(asAdmin.json().payUrl).toMatch(/^https:\/\/invoice\.stripe\.test\//);

    const asMember = await call('GET', `/invoices/${invoice.id}`, 'token-client-member');
    expect(asMember.json().payUrl).toBeNull();
    expect(asMember.json().status).toBe('enviada');
  });

  it('si Stripe no responde, la factura queda en borrador y la bitácora registra el intento', async () => {
    const invoice = await draft();
    billing.failNext();
    const response = await call('POST', `/invoices/${invoice.id}/issue`, 'token-owner');
    expect(response.statusCode).toBe(502);

    const current = await call('GET', `/invoices/${invoice.id}`, 'token-client');
    expect(current.json().status).toBe('borrador');
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'invoice.issue_failed')).toBe(true);
  });

  it('una factura emitida se anula en Stripe y no se borra', async () => {
    const invoice = await draft();
    await call('POST', `/invoices/${invoice.id}/issue`, 'token-owner');
    const voided = await call('POST', `/invoices/${invoice.id}/void`, 'token-owner');
    expect(voided.json().status).toBe('anulada');
    expect(billing.calls.some((c) => c.op === 'voidInvoice')).toBe(true);
  });

  it('un miembro no puede emitir ni anular facturas', async () => {
    const invoice = await draft();
    const response = await call('POST', `/invoices/${invoice.id}/issue`, 'token-client');
    expect(response.statusCode).toBe(403);
  });

  it('el webhook de Stripe con firma válida marca la factura como pagada, y repetirlo no cambia nada', async () => {
    const invoice = await draft();
    await call('POST', `/invoices/${invoice.id}/issue`, 'token-owner');
    const stripeInvoiceId = `in_${billing.calls.length}`;
    const event = { type: 'invoice.paid', created: Math.floor(Date.now() / 1000), data: { object: { id: stripeInvoiceId } } };
    const { raw, header } = signed(event);

    const first = await app.inject({ method: 'POST', url: '/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': header }, payload: raw });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: '/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': header }, payload: raw });
    expect(second.statusCode).toBe(200);

    const current = await call('GET', `/invoices/${invoice.id}`, 'token-client');
    expect(current.json().status).toBe('pagada');
    const paidEntries = (await db.select().from(auditLog)).filter((e) => e.action === 'invoice.paid');
    expect(paidEntries).toHaveLength(1);
  });

  it('un webhook con firma incorrecta o vencida se rechaza', async () => {
    const event = { type: 'invoice.paid', created: 1, data: { object: { id: 'in_x' } } };
    const wrong = signed(event, 'otro_secreto');
    const response = await app.inject({ method: 'POST', url: '/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': wrong.header }, payload: wrong.raw });
    expect(response.statusCode).toBe(400);

    const old = signed(event, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600);
    const late = await app.inject({ method: 'POST', url: '/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': old.header }, payload: old.raw });
    expect(late.statusCode).toBe(400);
  });
});

describe('poder del owner y del administrador del cliente', () => {
  it('el owner suspende una organización: el cliente queda fuera, el owner sigue viendo todo y nada se borra', async () => {
    const suspended = await call('POST', `/organizations/${clientOrgId}/suspend`, 'token-owner', { reason: 'Impago verificado' });
    expect(suspended.json().status).toBe('suspended');

    const clientView = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(clientView.statusCode).toBe(403);
    expect(clientView.json().error).toBe('suspended');

    const ownerView = await call('GET', `/projects/${projectId}`, 'token-owner');
    expect(ownerView.statusCode).toBe(200);
    const rows = await db.select().from(projects);
    expect(rows).toHaveLength(1);
  });

  it('reactivar devuelve el acceso al cliente', async () => {
    await call('POST', `/organizations/${clientOrgId}/suspend`, 'token-owner', { reason: 'Revisión' });
    await call('POST', `/organizations/${clientOrgId}/reactivate`, 'token-owner');
    const response = await call('GET', `/projects/${projectId}`, 'token-client');
    expect(response.statusCode).toBe(200);
  });

  it('solo el owner puede suspender', async () => {
    const response = await call('POST', `/organizations/${clientOrgId}/suspend`, 'token-client', { reason: 'Mía' });
    expect(response.statusCode).toBe(403);
  });

  it('el administrador del cliente lista su equipo; el miembro no', async () => {
    const admin = await call('GET', `/organizations/${clientOrgId}/members`, 'token-client');
    expect(admin.statusCode).toBe(200);
    expect(admin.json().members).toHaveLength(3);

    const member = await call('GET', `/organizations/${clientOrgId}/members`, 'token-client-member');
    expect(member.statusCode).toBe(403);
  });

  it('el administrador cambia el rol de un miembro y queda en la bitácora', async () => {
    const response = await call('PATCH', `/organizations/${clientOrgId}/members/user_client_2`, 'token-client', { role: 'org:admin' });
    expect(response.statusCode).toBe(200);
    expect(identity.roleChanges).toEqual([{ orgId: CLIENT, userId: 'user_client_2', role: 'org:admin' }]);
    const entries = await db.select().from(auditLog);
    expect(entries.some((e) => e.action === 'member.role_changed')).toBe(true);
  });

  it('no se puede quitar el último administrador de la organización', async () => {
    const response = await call('PATCH', `/organizations/${clientOrgId}/members/user_client`, 'token-client', { role: 'org:member' });
    expect(response.statusCode).toBe(409);
    expect(identity.roleChanges).toHaveLength(0);
  });

  it('un administrador de otra organización no gestiona este equipo', async () => {
    const response = await call('PATCH', `/organizations/${clientOrgId}/members/user_client_2`, 'token-other', { role: 'org:admin' });
    expect(response.statusCode).toBe(403);
  });

  it('el administrador retira a un miembro, y el owner sigue pudiendo hacerlo', async () => {
    const removed = await call('DELETE', `/organizations/${clientOrgId}/members/user_client_2`, 'token-client');
    expect(removed.statusCode).toBe(204);
    expect(identity.removed).toEqual([{ orgId: CLIENT, userId: 'user_client_2' }]);
  });

  it('el owner ve la ficha de la organización con su equipo; el cliente no', async () => {
    const owner = await call('GET', `/organizations/${clientOrgId}`, 'token-owner');
    expect(owner.statusCode).toBe(200);
    expect(owner.json().members).toHaveLength(3);
    const client = await call('GET', `/organizations/${clientOrgId}`, 'token-client');
    expect(client.statusCode).toBe(403);
  });
});
