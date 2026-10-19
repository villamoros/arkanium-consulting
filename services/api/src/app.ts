import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { healthResponseSchema, leadDecisionSchema, leadDeleteSchema, leadIntakeSchema, leadManualSchema, leadUpdateSchema, memberInvitationSchema, type HealthResponse, type Lead as LeadDto } from '@arkanium/contracts';
import type { IdentityGateway } from './auth/clerk.js';
import type { Db } from './db/client.js';
import { createManualLead, decideLead, captureLead, convertLead, deleteLead, findLead, listLeads, LeadError, updateLead, type Lead } from './leads/service.js';
import { inviteMember, OrganizationError } from './organizations/service.js';
import { decideDestination, listDestinations } from './session/destination.js';
import { sendServiceError } from './access.js';
import { ServiceError } from './errors.js';
import type { BillingGateway } from './billing/stripe.js';
import type { CalendarGateway } from './calendar/n8n.js';
import { verifyStripeSignature } from './billing/stripe.js';
import { markPaidFromStripe } from './billing/service.js';
import { registerOperationRoutes } from './routes/operations.js';

export const SERVICE_NAME = 'arkanium-api';
export const SERVICE_VERSION = '0.1.0';

export interface AppOptions {
  logger?: boolean;
  /** Clerk (o un doble en pruebas). Sin él, las rutas que requieren identidad no existen. */
  identity?: IdentityGateway;
  /** ID de la organización interna de Arkanium. */
  internalOrgId?: string;
  /** Orígenes del navegador permitidos. */
  corsOrigins?: string[];
  /** Base de datos. Sin ella, las rutas de leads no existen. */
  db?: Db;
  /** Token de servicio que usa el sitio para entregar leads (F-01). Sin él, la captación responde 503. */
  leadIntakeToken?: string;
  /** Facturación (Stripe, claves de prueba mientras no esté constituida la LLC). Sin ella, emitir responde 503. */
  billing?: BillingGateway;
  /** Secreto del webhook de Stripe para confirmar pagos. Sin él, el webhook responde 503. */
  stripeWebhookSecret?: string;
  /** Calendario vía n8n: crea el evento al confirmar una reunión. Sin él, la confirmación no crea evento. */
  calendar?: CalendarGateway;
  /** Secreto de n8n para las rutas internas (recordatorios). Sin él, esas rutas responden 401. */
  internalSecret?: string;
}

/**
 * Construye la aplicación sin escuchar en un puerto.
 * Así las pruebas la usan con inject() y no levantan el servidor.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  // El límite de 8 MB cubre un entregable de 5 MB en base64; el tope real de 5 MB lo aplica el servicio.
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 8 * 1024 * 1024 });

  if (options.corsOrigins?.length) {
    app.register(cors, { origin: options.corsOrigins });
  }

  // Errores de negocio con código HTTP; el resto sigue el camino normal de Fastify.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ServiceError) return sendServiceError(reply, error);
    return reply.send(error);
  });

  app.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({ status: 'ok', service: SERVICE_NAME, version: SERVICE_VERSION });
  });

  if (options.identity && options.internalOrgId) {
    const { identity, internalOrgId } = options;

    app.get('/session/destination', async (request, reply) => {
      const userId = await authenticate(request, identity);
      if (!userId) return reply.code(401).send({ error: 'unauthorized' });

      const memberships = await identity.listOrganizations(userId);
      return decideDestination(memberships, internalOrgId);
    });

    // Todos los destinos de la persona, para el menú de sesión del sitio.
    app.get('/session/destinations', async (request, reply) => {
      const userId = await authenticate(request, identity);
      if (!userId) return reply.code(401).send({ error: 'unauthorized' });

      const memberships = await identity.listOrganizations(userId);
      return { destinations: listDestinations(memberships, internalOrgId) };
    });

    if (options.db) {
      const db = options.db;
      registerLeadRoutes(app, { db, identity, internalOrgId, leadIntakeToken: options.leadIntakeToken });
      registerMemberRoutes(app, { db, identity, internalOrgId });
      registerOperationRoutes(app, { db, identity, internalOrgId, billing: options.billing, calendar: options.calendar, internalSecret: options.internalSecret });
      registerStripeWebhook(app, { db, secret: options.stripeWebhookSecret });
    }
  }

  return app;
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

async function authenticate(request: FastifyRequest, identity: IdentityGateway): Promise<string | null> {
  const token = bearerToken(request);
  return token ? identity.verifyBearer(token) : null;
}

/** Solo el administrador de la organización interna pasa. Se comprueba con la membresía verificada en Clerk. */
async function requireOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  identity: IdentityGateway,
  internalOrgId: string,
): Promise<string | null> {
  const userId = await authenticate(request, identity);
  if (!userId) {
    await reply.code(401).send({ error: 'unauthorized' });
    return null;
  }
  const memberships = await identity.listOrganizations(userId);
  const isOwner = memberships.some((m) => m.orgId === internalOrgId && m.role === 'org:admin');
  if (!isOwner) {
    await reply.code(403).send({ error: 'forbidden' });
    return null;
  }
  return userId;
}

/** Comparación en tiempo constante, para que el token no se pueda adivinar por tiempos de respuesta. */
function sameSecret(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function toLeadDto(lead: Lead): LeadDto {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    priorityChoice: lead.priorityChoice,
    locale: lead.locale,
    status: lead.status,
    receivedAt: lead.receivedAt.toISOString(),
    organizationId: lead.organizationId,
    context: lead.context,
    source: lead.source,
    sourceReference: lead.sourceReference,
    proposedFamily: lead.proposedFamily,
    proposedReason: lead.proposedReason,
    decisionNote: lead.decisionNote,
    revisitAt: lead.revisitAt?.toISOString() ?? null,
    notifiedAt: lead.notifiedAt?.toISOString() ?? null,
    notifyAttempts: lead.notifyAttempts,
    notifyLastError: lead.notifyLastError,
  };
}

function leadError(reply: FastifyReply, error: unknown) {
  if (error instanceof LeadError) {
    const status = error.code === 'not_found' ? 404 : 409;
    return reply.code(status).send({ error: error.code, message: error.message });
  }
  throw error;
}

interface LeadRouteDeps {
  db: Db;
  identity: IdentityGateway;
  internalOrgId: string;
  leadIntakeToken?: string;
}

function registerLeadRoutes(app: FastifyInstance, deps: LeadRouteDeps): void {
  const { db, identity, internalOrgId, leadIntakeToken } = deps;

  // F-01: el sitio entrega el lead. Solo con el token de servicio.
  app.post('/leads', async (request, reply) => {
    if (!leadIntakeToken) return reply.code(503).send({ error: 'intake_not_configured' });
    if (!sameSecret(bearerToken(request), leadIntakeToken)) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = leadIntakeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid' });

    const lead = await captureLead(db, parsed.data);
    return reply.code(201).send(toLeadDto(lead));
  });

  // Lista de leads para el owner.
  app.get<{ Querystring: { status?: Lead['status'] } }>('/leads', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;
    const leadsList = await listLeads(db, request.query.status);
    return { leads: leadsList.map(toLeadDto) };
  });

  // Detalle de un lead para el owner.
  app.get<{ Params: { id: string } }>('/leads/:id', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;
    try {
      return toLeadDto(await findLead(db, request.params.id));
    } catch (error) {
      return leadError(reply, error);
    }
  });

  // Alta manual de un lead (owner): mensaje directo, comentario, referido o evento.
  app.post('/leads/manual', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;
    const parsed = leadManualSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid' });
    return reply.code(201).send(toLeadDto(await createManualLead(db, parsed.data, ownerId)));
  });

  // Edición de datos de un lead (owner).
  app.patch<{ Params: { id: string } }>('/leads/:id', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;
    const parsed = leadUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid' });
    try {
      return toLeadDto(await updateLead(db, request.params.id, parsed.data, ownerId));
    } catch (error) {
      return leadError(reply, error);
    }
  });

  // Eliminación suave de un lead (owner). Exige motivo; el registro y la bitácora se conservan.
  app.delete<{ Params: { id: string } }>('/leads/:id', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;
    const parsed = leadDeleteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Escribe el motivo de la eliminación.' });
    try {
      await deleteLead(db, request.params.id, parsed.data.reason, ownerId);
      return reply.code(204).send();
    } catch (error) {
      return leadError(reply, error);
    }
  });

  // F-02: el owner califica, pospone o descarta.
  app.post<{ Params: { id: string } }>('/leads/:id/decision', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;

    const parsed = leadDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid' });

    try {
      return toLeadDto(await decideLead(db, request.params.id, parsed.data, ownerId));
    } catch (error) {
      return leadError(reply, error);
    }
  });

  // F-04: convierte un lead calificado en organización de cliente.
  app.post<{ Params: { id: string } }>('/leads/:id/convert', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;

    try {
      const { lead, organizationId } = await convertLead(db, request.params.id, ownerId, identity);
      return { lead: toLeadDto(lead), organizationId };
    } catch (error) {
      return leadError(reply, error);
    }
  });
}

interface MemberRouteDeps {
  db: Db;
  identity: IdentityGateway;
  internalOrgId: string;
}

function registerMemberRoutes(app: FastifyInstance, deps: MemberRouteDeps): void {
  const { db, identity, internalOrgId } = deps;

  // D-03: el owner invita a una persona por correo con su rol.
  app.post<{ Params: { id: string } }>('/organizations/:id/invitations', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;

    const parsed = memberInvitationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid' });

    try {
      const result = await inviteMember(db, identity, { organizationId: request.params.id, ...parsed.data, ownerId });
      return reply.code(201).send(result);
    } catch (error) {
      return organizationError(reply, error);
    }
  });

}

/**
 * Webhook de Stripe. Solo confirma pagos (invoice.paid). Lee el cuerpo sin transformar,
 * porque la firma se calcula sobre los bytes exactos que envía Stripe.
 */
function registerStripeWebhook(app: FastifyInstance, deps: { db: Db; secret?: string }): void {
  const { db, secret } = deps;
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => done(null, body));

    scope.post('/webhooks/stripe', async (request, reply) => {
      if (!secret) return reply.code(503).send({ error: 'webhook_not_configured' });
      const raw = typeof request.body === 'string' ? request.body : '';
      const signature = request.headers['stripe-signature'];
      if (!verifyStripeSignature(raw, typeof signature === 'string' ? signature : undefined, secret)) {
        return reply.code(400).send({ error: 'invalid_signature' });
      }

      let event: { type: string; created: number; data: { object: { id: string } } };
      try {
        event = JSON.parse(raw);
      } catch {
        return reply.code(400).send({ error: 'invalid' });
      }
      if (event.type === 'invoice.paid') {
        await markPaidFromStripe(db, event.data.object.id, new Date(event.created * 1000));
      }
      return reply.code(200).send({ received: true });
    });
  });
}

function organizationError(reply: FastifyReply, error: unknown) {
  if (error instanceof OrganizationError) {
    const status = error.code === 'not_found' ? 404 : 409;
    return reply.code(status).send({ error: error.code, message: error.message });
  }
  throw error;
}
