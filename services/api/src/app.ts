import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { healthResponseSchema, leadDecisionSchema, leadIntakeSchema, memberInvitationSchema, type HealthResponse, type Lead as LeadDto } from '@arkanium/contracts';
import type { IdentityGateway } from './auth/clerk.js';
import type { Db } from './db/client.js';
import { decideLead, captureLead, convertLead, listLeads, LeadError, type Lead } from './leads/service.js';
import { inviteMember, removeMember, OrganizationError } from './organizations/service.js';
import { decideDestination } from './session/destination.js';

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
}

/**
 * Construye la aplicación sin escuchar en un puerto.
 * Así las pruebas la usan con inject() y no levantan el servidor.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  if (options.corsOrigins?.length) {
    app.register(cors, { origin: options.corsOrigins });
  }

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

    if (options.db) {
      registerLeadRoutes(app, { db: options.db, identity, internalOrgId, leadIntakeToken: options.leadIntakeToken });
      registerMemberRoutes(app, { db: options.db, identity, internalOrgId });
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

  // D-03: el owner retira a una persona de la organización.
  app.delete<{ Params: { id: string; userId: string } }>('/organizations/:id/members/:userId', async (request, reply) => {
    const ownerId = await requireOwner(request, reply, identity, internalOrgId);
    if (!ownerId) return;

    try {
      await removeMember(db, identity, { organizationId: request.params.id, userId: request.params.userId, ownerId });
      return reply.code(204).send();
    } catch (error) {
      return organizationError(reply, error);
    }
  });
}

function organizationError(reply: FastifyReply, error: unknown) {
  if (error instanceof OrganizationError) {
    const status = error.code === 'not_found' ? 404 : 409;
    return reply.code(status).send({ error: error.code, message: error.message });
  }
  throw error;
}
