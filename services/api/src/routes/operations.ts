/**
 * Rutas de proyectos, entregables, reuniones, facturas, decisiones y equipo.
 * Las del owner van desde core; las del cliente, desde la app. Cada una pasa por access.ts.
 */
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  leadMeetingSchema,
  leadProposalSchema,
  meetingCancelSchema,
  meetingProposeSchema,
  meetingDeleteSchema,
  meetingManualSchema,
  meetingRejectSchema,
  meetingRescheduleSchema,
  meetingUpdateSchema,
  suppressionSchema,
  correctionCreateSchema,
  correctionResolveSchema,
  deliverableApprovalSchema,
  deliverableContentSchema,
  deliverableCreateSchema,
  invoiceDraftSchema,
  meetingConfirmSchema,
  meetingRequestSchema,
  memberRoleSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  minutesPublishSchema,
  organizationSuspendSchema,
  projectCreateSchema,
} from '@arkanium/contracts';
import { loadCaller, requireClientAccess, requireOwnerCaller, findOrganization, sendServiceError, type Caller } from '../access.js';
import type { IdentityGateway } from '../auth/clerk.js';
import type { BillingGateway } from '../billing/stripe.js';
import { createDraft, clientInvoiceView, findInvoice, issueInvoice, listInvoices, voidInvoice } from '../billing/service.js';
import type { CalendarGateway } from '../calendar/n8n.js';
import type { Db } from '../db/client.js';
import { deliverables } from '../db/schema.js';
import { listDecisions } from '../decisions/service.js';
import {
  addCorrection,
  approveByClient,
  clientFile,
  createDeliverable,
  findDeliverable,
  listDeliverables,
  listOpenCorrections,
  organizationOfDeliverable,
  publishDeliverable,
  resolveCorrection,
  uploadContent,
} from '../deliverables/service.js';
import { ServiceError } from '../errors.js';
import { changeMemberRole, listMembers, removeMemberGuarded, setOrganizationStatus } from '../organizations/admin.js';
import {
  cancelMeeting,
  clientMeetingView,
  confirmMeeting,
  createLeadMeeting,
  dueReminders,
  listAllMeetings,
  listMeetings,
  markReminded,
  ownerMeetingView,
  proposeMeetingTime,
  publishMinutes,
  rejectMeeting,
  requestMeeting,
  rescheduleMeeting,
  retryCalendar,
  createManualMeeting,
  deleteMeeting,
  listClientOrganizations,
  updateMeeting,
} from '../meetings/service.js';
import { addSuppression, listSuppressions } from '../suppressions/service.js';
import { duplicatesOf, leadHistory, LeadError, respondToProposal } from '../leads/service.js';
import { addMilestone, createProject, findProject, listMilestones, listProjects, updateMilestone } from '../projects/service.js';

export interface OperationDeps {
  db: Db;
  identity: IdentityGateway;
  internalOrgId: string;
  billing?: BillingGateway;
  /** Calendario (n8n → Google). Sin él, la reunión se confirma pero el evento no se crea. */
  calendar?: CalendarGateway;
  /** Secreto que n8n usa para llamar a las rutas internas (recordatorios). */
  internalSecret?: string;
}

/** Valida el cuerpo con un esquema; responde 400 si no pasa. Devuelve null si ya respondió. */
function parseBody<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, request: FastifyRequest, reply: FastifyReply): T | null {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send({ error: 'invalid' });
    return null;
  }
  return parsed.data;
}

type Handler<P = Record<string, string>> = (request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => Promise<unknown>;

/** Envuelve una ruta: identifica a la persona y traduce los errores de negocio. */
function guarded<P>(deps: OperationDeps, handler: (caller: Caller, request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => Promise<unknown>): Handler<P> {
  return async (request, reply) => {
    const caller = await loadCaller(request, reply, deps.identity);
    if (!caller) return reply;
    try {
      return await handler(caller, request, reply);
    } catch (error) {
      if (error instanceof ServiceError) return sendServiceError(reply, error);
      if (error instanceof LeadError) return reply.code(error.code === 'not_found' ? 404 : 409).send({ error: error.code, message: error.message });
      throw error;
    }
  };
}

/** Llamada de n8n: lleva el secreto del webhook en la cabecera, no una sesión de Clerk. */
function isInternalCall(request: FastifyRequest, secret: string | undefined): boolean {
  const header = request.headers['x-arkanium-secret'];
  if (!secret || typeof header !== 'string') return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function registerOperationRoutes(app: FastifyInstance, deps: OperationDeps): void {
  const { db, identity, internalOrgId, billing, calendar } = deps;

  // ───────────── Organización (owner y administrador del cliente) ─────────────

  // Core: ficha de la organización con su equipo.
  app.get<{ Params: { id: string } }>(
    '/organizations/:id',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const organization = await findOrganization(db, request.params.id);
      const members = organization.clerkOrgId ? await listMembers(identity, organization) : [];
      return { organization: { id: organization.id, name: organization.name, status: organization.status, billingEmail: organization.billingEmail }, members };
    }),
  );

  // Core: suspende el acceso del cliente sin borrar nada.
  app.post<{ Params: { id: string } }>(
    '/organizations/:id/suspend',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(organizationSuspendSchema, request, reply);
      if (!body) return;
      const organization = await findOrganization(db, request.params.id);
      const updated = await setOrganizationStatus(db, organization, 'suspended', { actor: caller.userId, reason: body.reason });
      return { id: updated.id, status: updated.status };
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/organizations/:id/reactivate',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const organization = await findOrganization(db, request.params.id);
      const updated = await setOrganizationStatus(db, organization, 'active', { actor: caller.userId });
      return { id: updated.id, status: updated.status };
    }),
  );

  // Equipo del cliente: lista (administrador o owner).
  app.get<{ Params: { id: string } }>(
    '/organizations/:id/members',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId, { admin: true });
      return { members: await listMembers(identity, organization) };
    }),
  );

  // Equipo del cliente: cambiar rol (administrador de esa organización o owner).
  app.patch<{ Params: { id: string; userId: string } }>(
    '/organizations/:id/members/:userId',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId, { admin: true });
      const body = parseBody(memberRoleSchema, request, reply);
      if (!body) return;
      await changeMemberRole(db, identity, organization, { userId: request.params.userId, role: body.role, actor: caller.userId });
      return { userId: request.params.userId, role: body.role };
    }),
  );

  // Equipo del cliente: retirar a una persona (administrador de esa organización o owner).
  app.delete<{ Params: { id: string; userId: string } }>(
    '/organizations/:id/members/:userId',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId, { admin: true });
      await removeMemberGuarded(db, identity, organization, { userId: request.params.userId, actor: caller.userId });
      return reply.code(204).send();
    }),
  );

  // Registro de decisiones del cliente (solo lectura para la organización).
  app.get<{ Params: { id: string } }>(
    '/organizations/:id/decisions',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId);
      const rows = await listDecisions(db, organization.id);
      return {
        decisions: rows.map((d) => ({
          id: d.id,
          kind: d.kind,
          projectId: d.projectId,
          text: d.text,
          actorId: d.actorId,
          actorRole: d.actorRole,
          documentSha256: d.documentSha256,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    }),
  );

  // ───────────── Proyectos (F-05) ─────────────

  app.post<{ Params: { id: string } }>(
    '/organizations/:id/projects',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(projectCreateSchema, request, reply);
      if (!body) return;
      const organization = await findOrganization(db, request.params.id);
      return reply.code(201).send(await createProject(db, organization.id, body, caller.userId));
    }),
  );

  app.get<{ Params: { id: string } }>(
    '/organizations/:id/projects',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId);
      return { projects: (await listProjects(db, organization.id)).map(projectDto) };
    }),
  );

  // Vista del proyecto: hitos, entregables (con su disponibilidad), reuniones y facturas.
  app.get<{ Params: { id: string } }>(
    '/projects/:id',
    guarded(deps, async (caller, request, reply) => {
      const project = await findProject(db, request.params.id);
      const organization = await findOrganization(db, project.organizationId);
      const role = requireClientAccess(caller, organization, internalOrgId);
      const deliverableRows = await listDeliverables(db, project.id);
      const open = await listOpenCorrections(db, deliverableRows.map((d) => d.id));
      const milestoneRows = await listMilestones(db, project.id);
      const meetingRows = (await listMeetings(db, organization.id)).filter((m) => m.projectId === project.id);
      const invoiceRows = (await listInvoices(db, organization.id)).filter((i) => i.projectId === project.id);
      return {
        project: projectDto(project),
        milestones: milestoneRows.map((m) => ({
          id: m.id,
          name: m.name,
          status: m.status,
          plannedDate: m.plannedDate?.toISOString() ?? null,
          dateChanged: m.dateChangedAt !== null,
        })),
        deliverables: deliverableRows.map((d) => ({
          id: d.id,
          title: d.title,
          version: d.version,
          status: d.status,
          fileName: d.fileName,
          downloadable: d.status !== 'en_revision' && d.content !== null,
          openCorrections: open.filter((c) => c.deliverableId === d.id).length,
        })),
        meetings: meetingRows.map(clientMeetingView),
        invoices: invoiceRows.map((i) => clientInvoiceView(i, role === 'org:admin' || role === 'owner')),
      };
    }),
  );

  // Hitos (owner): alta y cambios. Cambiar una fecha prevista deja marca para avisar (D-21).
  app.post<{ Params: { id: string } }>(
    '/projects/:id/milestones',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(milestoneCreateSchema, request, reply);
      if (!body) return;
      return reply.code(201).send(milestoneDto(await addMilestone(db, request.params.id, body, caller.userId)));
    }),
  );

  app.patch<{ Params: { id: string } }>(
    '/milestones/:id',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(milestoneUpdateSchema, request, reply);
      if (!body) return;
      return milestoneDto(await updateMilestone(db, request.params.id, body, caller.userId));
    }),
  );

  // ───────────── Entregables (F-08, A-02, A-03) ─────────────

  app.post<{ Params: { id: string } }>(
    '/projects/:id/deliverables',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(deliverableCreateSchema, request, reply);
      if (!body) return;
      await findProject(db, request.params.id);
      return reply.code(201).send(deliverableDto(await createDeliverable(db, request.params.id, body.title, caller.userId)));
    }),
  );

  app.put<{ Params: { id: string } }>(
    '/deliverables/:id/content',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(deliverableContentSchema, request, reply);
      if (!body) return;
      return deliverableDto(await uploadContent(db, request.params.id, body, caller.userId));
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/deliverables/:id/publish',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      return deliverableDto(await publishDeliverable(db, request.params.id, caller.userId));
    }),
  );

  // Descarga del cliente. Solo después de publicar; cada descarga queda en la bitácora.
  app.get<{ Params: { id: string } }>(
    '/deliverables/:id/file',
    guarded(deps, async (caller, request, reply) => {
      const deliverable = await findDeliverable(db, request.params.id);
      const organization = await findOrganization(db, await organizationOfDeliverable(db, deliverable));
      requireClientAccess(caller, organization, internalOrgId);
      const file = await clientFile(db, deliverable, caller.userId);
      return reply
        .header('content-type', file.mimeType)
        .header('content-disposition', `attachment; filename="${file.fileName.replace(/"/g, '')}"`)
        .header('x-content-sha256', file.sha256)
        .send(file.content);
    }),
  );

  // A-03: el cliente deja una corrección (miembro o administrador).
  app.post<{ Params: { id: string } }>(
    '/deliverables/:id/corrections',
    guarded(deps, async (caller, request, reply) => {
      const deliverable = await findDeliverable(db, request.params.id);
      const organization = await findOrganization(db, await organizationOfDeliverable(db, deliverable));
      const role = requireClientAccess(caller, organization, internalOrgId);
      const body = parseBody(correctionCreateSchema, request, reply);
      if (!body) return;
      const correction = await addCorrection(db, deliverable, organization.id, body.text, { id: caller.userId, role });
      return reply.code(201).send({ id: correction.id, status: correction.status });
    }),
  );

  // A-02: el administrador del cliente aprueba con su texto exacto.
  app.post<{ Params: { id: string } }>(
    '/deliverables/:id/approve',
    guarded(deps, async (caller, request, reply) => {
      const deliverable = await findDeliverable(db, request.params.id);
      const organization = await findOrganization(db, await organizationOfDeliverable(db, deliverable));
      const role = requireClientAccess(caller, organization, internalOrgId, { admin: true });
      const body = parseBody(deliverableApprovalSchema, request, reply);
      if (!body) return;
      return deliverableDto(await approveByClient(db, deliverable, organization.id, body.text, { id: caller.userId, role }));
    }),
  );

  // Owner: atiende una corrección.
  app.post<{ Params: { id: string } }>(
    '/corrections/:id/resolve',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(correctionResolveSchema, request, reply);
      if (!body) return;
      const correction = await resolveCorrection(db, request.params.id, body.note, caller.userId);
      return { id: correction.id, status: correction.status };
    }),
  );

  // ───────────── Reuniones (F-03, A-04, F-09, A-05) ─────────────

  app.post<{ Params: { id: string } }>(
    '/organizations/:id/meetings',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      const role = requireClientAccess(caller, organization, internalOrgId);
      const body = parseBody(meetingRequestSchema, request, reply);
      if (!body) return;
      const meeting = await requestMeeting(db, organization.id, body, { id: caller.userId, role });
      return reply.code(201).send(clientMeetingView(meeting));
    }),
  );

  app.get<{ Params: { id: string } }>(
    '/organizations/:id/meetings',
    guarded(deps, async (caller, request, reply) => {
      const organization = await findOrganization(db, request.params.id);
      requireClientAccess(caller, organization, internalOrgId);
      return { meetings: (await listMeetings(db, organization.id)).map(clientMeetingView) };
    }),
  );

  // Core: agenda de reuniones de todas las organizaciones (solicitudes pendientes incluidas).
  app.get(
    '/meetings',
    guarded(deps, async (caller) => {
      requireOwnerCaller(caller, internalOrgId);
      return { meetings: await listAllMeetings(db) };
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/confirm',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingConfirmSchema, request, reply);
      if (!body) return;
      const { meeting, calendar: sync } = await confirmMeeting(db, calendar, request.params.id, body, caller.userId);
      return { ...ownerMeetingView(meeting, null), calendar: sync };
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/reject',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingRejectSchema, request, reply);
      if (!body) return;
      return ownerMeetingView(await rejectMeeting(db, request.params.id, body.reason, caller.userId), null);
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/propose',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingProposeSchema, request, reply);
      if (!body) return;
      return ownerMeetingView(await proposeMeetingTime(db, request.params.id, body, caller.userId), null);
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/cancel',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingCancelSchema, request, reply);
      if (!body) return;
      return ownerMeetingView(await cancelMeeting(db, calendar, request.params.id, body.reason, caller.userId), null);
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/reschedule',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingRescheduleSchema, request, reply);
      if (!body) return;
      const { meeting, calendar: sync } = await rescheduleMeeting(db, calendar, request.params.id, body, caller.userId);
      return { ...ownerMeetingView(meeting, null), calendar: sync };
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/calendar/retry',
    guarded(deps, async (caller, request) => {
      requireOwnerCaller(caller, internalOrgId);
      const { meeting, calendar: sync } = await retryCalendar(db, calendar, request.params.id, caller.userId);
      return { ...ownerMeetingView(meeting, null), calendar: sync };
    }),
  );

  // ───────────── Gestión manual de reuniones (respaldo si n8n o Calendar fallan) ─────────────

  // Core: clientes para elegir al crear una reunión a mano.
  app.get(
    '/client-organizations',
    guarded(deps, async (caller) => {
      requireOwnerCaller(caller, internalOrgId);
      return { organizations: await listClientOrganizations(db) };
    }),
  );

  // Core: crear una reunión a mano. Con fecha queda confirmada y se intenta el evento; si falla, queda pendiente.
  app.post(
    '/meetings/manual',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingManualSchema, request, reply);
      if (!body) return;
      const { meeting, calendar: sync } = await createManualMeeting(db, calendar, body, caller.userId);
      return reply.code(201).send({ ...ownerMeetingView(meeting, null), calendar: sync });
    }),
  );

  // Core: corregir una reunión a mano (tema, invitados, hora y duración).
  app.patch<{ Params: { id: string } }>(
    '/meetings/:id',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingUpdateSchema, request, reply);
      if (!body) return;
      const { meeting, calendar: sync } = await updateMeeting(db, calendar, request.params.id, body, caller.userId);
      return { ...ownerMeetingView(meeting, null), calendar: sync };
    }),
  );

  // Core: eliminar una reunión (borrado lógico). Si el evento no se puede quitar, no elimina salvo con force.
  app.delete<{ Params: { id: string } }>(
    '/meetings/:id',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(meetingDeleteSchema, request, reply);
      if (!body) return;
      return deleteMeeting(db, calendar, request.params.id, body, caller.userId);
    }),
  );

  // ───────────── Leads: reuniones, historial, duplicados y propuesta del agente (F-02, F-03) ─────────────

  app.post<{ Params: { id: string } }>(
    '/leads/:id/meetings',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(leadMeetingSchema, request, reply);
      if (!body) return;
      return reply.code(201).send(ownerMeetingView(await createLeadMeeting(db, request.params.id, body, caller.userId), null));
    }),
  );

  app.get<{ Params: { id: string } }>(
    '/leads/:id/history',
    guarded(deps, async (caller, request) => {
      requireOwnerCaller(caller, internalOrgId);
      return leadHistory(db, request.params.id);
    }),
  );

  app.get<{ Params: { id: string } }>(
    '/leads/:id/duplicates',
    guarded(deps, async (caller, request) => {
      requireOwnerCaller(caller, internalOrgId);
      const duplicates = await duplicatesOf(db, request.params.id);
      return { duplicates: duplicates.map((lead) => ({ id: lead.id, name: lead.name, email: lead.email, status: lead.status, receivedAt: lead.receivedAt.toISOString() })) };
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/leads/:id/proposal',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(leadProposalSchema, request, reply);
      if (!body) return;
      return respondToProposal(db, request.params.id, body, caller.userId);
    }),
  );

  // ───────────── Supresión: correos que no deben recibir contactos (consentimiento y baja) ─────────────

  app.get(
    '/suppressions',
    guarded(deps, async (caller) => {
      requireOwnerCaller(caller, internalOrgId);
      return { suppressions: await listSuppressions(db) };
    }),
  );

  app.post(
    '/suppressions',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(suppressionSchema, request, reply);
      if (!body) return;
      return reply.code(201).send(await addSuppression(db, body, caller.userId));
    }),
  );

  // ───────────── Rutas internas para n8n (recordatorios). Usan el secreto del webhook, no una sesión. ─────────────

  app.get<{ Querystring: { hours?: string } }>('/internal/meetings/due-reminders', async (request, reply) => {
    if (!isInternalCall(request, deps.internalSecret)) return reply.code(401).send({ error: 'unauthorized' });
    const hours = Math.min(Math.max(Number(request.query.hours ?? 24) || 24, 1), 168);
    return { meetings: await dueReminders(db, new Date(), hours) };
  });

  app.post<{ Params: { id: string } }>('/internal/meetings/:id/reminded', async (request, reply) => {
    if (!isInternalCall(request, deps.internalSecret)) return reply.code(401).send({ error: 'unauthorized' });
    try {
      await markReminded(db, request.params.id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ServiceError) return sendServiceError(reply, error);
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    '/meetings/:id/minutes',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(minutesPublishSchema, request, reply);
      if (!body) return;
      return clientMeetingView(await publishMinutes(db, request.params.id, body.text, caller.userId));
    }),
  );

  // ───────────── Facturas (F-10, A-06) ─────────────

  app.post<{ Params: { id: string } }>(
    '/organizations/:id/invoices',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      const body = parseBody(invoiceDraftSchema, request, reply);
      if (!body) return;
      const organization = await findOrganization(db, request.params.id);
      const invoice = await createDraft(db, organization.id, body, caller.userId);
      return reply.code(201).send(clientInvoiceView(invoice, false));
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/invoices/:id/issue',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      if (!billing) throw new ServiceError(503, 'billing_unavailable', 'La facturación no está configurada.');
      return clientInvoiceView(await issueInvoice(db, billing, request.params.id, caller.userId), false);
    }),
  );

  app.post<{ Params: { id: string } }>(
    '/invoices/:id/void',
    guarded(deps, async (caller, request, reply) => {
      requireOwnerCaller(caller, internalOrgId);
      if (!billing) throw new ServiceError(503, 'billing_unavailable', 'La facturación no está configurada.');
      return clientInvoiceView(await voidInvoice(db, billing, request.params.id, caller.userId), false);
    }),
  );

  // Factura del cliente. El enlace de pago solo lo ve un administrador de la organización.
  app.get<{ Params: { id: string } }>(
    '/invoices/:id',
    guarded(deps, async (caller, request, reply) => {
      const invoice = await findInvoice(db, request.params.id);
      const organization = await findOrganization(db, invoice.organizationId);
      const role = requireClientAccess(caller, organization, internalOrgId);
      return clientInvoiceView(invoice, role === 'org:admin' || role === 'owner');
    }),
  );
}

function projectDto(project: Awaited<ReturnType<typeof findProject>>) {
  return {
    id: project.id,
    name: project.name,
    serviceFamily: project.serviceFamily,
    phase: project.phase,
    progress: project.progress,
    nextStep: project.nextStep,
  };
}

function milestoneDto(milestone: { id: string; name: string; status: string; plannedDate: Date | null; dateChangedAt: Date | null }) {
  return {
    id: milestone.id,
    name: milestone.name,
    status: milestone.status,
    plannedDate: milestone.plannedDate?.toISOString() ?? null,
    dateChanged: milestone.dateChangedAt !== null,
  };
}

function deliverableDto(deliverable: typeof deliverables.$inferSelect) {
  return {
    id: deliverable.id,
    projectId: deliverable.projectId,
    title: deliverable.title,
    version: deliverable.version,
    status: deliverable.status,
    fileName: deliverable.fileName,
    contentSha256: deliverable.contentSha256,
  };
}

