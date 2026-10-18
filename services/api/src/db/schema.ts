/**
 * Esquema de la base de datos. Fuente: ARK-ARCH-001 (entidades) y ARK-ARCH-002 (flujos).
 * Primer contrato: F-01 captar lead, F-02 calificar, F-04 convertir en organización.
 * Además: cola de aprobaciones y bitácora, porque ninguna acción externa ocurre sin ellas.
 *
 * SQL estándar: el mismo esquema funciona en PostgreSQL local y en Supabase.
 */
import { boolean, customType, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Binario en PostgreSQL. Pensado para entregables pequeños en esta fase; ver deliverables. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const organizationKind = pgEnum('organization_kind', ['internal', 'client']);

export const organizationStatus = pgEnum('organization_status', ['active', 'suspended']);

export const leadStatus = pgEnum('lead_status', ['nuevo', 'calificado', 'pospuesto', 'descartado', 'convertido']);

export const serviceFamily = pgEnum('service_family', ['architecture', 'strategy', 'product', 'unknown']);

export const approvalStatus = pgEnum('approval_status', ['pendiente', 'aprobada', 'devuelta', 'rechazada']);

/** Organización = empresa. En clientes, corresponde a una organización de Clerk. */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Identificador de la organización en Clerk (org_…). Único cuando existe. */
    clerkOrgId: text('clerk_org_id'),
    name: text('name').notNull(),
    kind: organizationKind('kind').notNull().default('client'),
    /** Suspendida: el owner corta el acceso del cliente sin borrar nada. */
    status: organizationStatus('status').notNull().default('active'),
    /** Cliente de Stripe, creado la primera vez que se emite una factura. */
    stripeCustomerId: text('stripe_customer_id'),
    billingEmail: text('billing_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('organizations_clerk_org_id_uq').on(t.clerkOrgId)],
);

/** Buyer persona: segmento de cliente ideal (ARK-ARCH-001). No es una cuenta de usuario. */
export const buyerPersonas = pgTable('buyer_personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  segment: text('segment').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Campaña: esfuerzo de mercadeo que atrae interesados (ARK-ARCH-001). */
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  buyerPersonaId: uuid('buyer_persona_id').references(() => buyerPersonas.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Lead: persona u organización interesada. Puede convertirse en organización (F-04). */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    /** Área de interés que eligió en el formulario: familia del catálogo o «unsure». */
    priorityChoice: text('priority_choice').notNull(),
    context: text('context'),
    locale: text('locale').notNull(),
    source: text('source').notNull().default('website'),
    /** Perfil o enlace de origen cuando el lead llega por una red social o un mensaje directo. */
    sourceReference: text('source_reference'),
    campaignId: uuid('campaign_id').references(() => campaigns.id),
    buyerPersonaId: uuid('buyer_persona_id').references(() => buyerPersonas.id),
    status: leadStatus('status').notNull().default('nuevo'),
    /** Propuesta del agente de calificación (F-02). Solo informa; la decisión la toma el owner. */
    proposedFamily: serviceFamily('proposed_family').default('unknown'),
    proposedReason: text('proposed_reason'),
    /** Motivo de la decisión del owner (calificar, posponer o descartar). */
    decisionNote: text('decision_note'),
    /** Cuándo volver a revisar un lead pospuesto. */
    revisitAt: timestamp('revisit_at', { withTimezone: true }),
    organizationId: uuid('organization_id').references(() => organizations.id),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    /** Borrado suave: el lead deja de aparecer, pero su registro y su bitácora se conservan. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_status_idx').on(t.status), index('leads_received_at_idx').on(t.receivedAt)],
);

/** Contacto: persona concreta asociada a un lead o a una organización (ARK-ARCH-001). */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    leadId: uuid('lead_id').references(() => leads.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contacts_organization_idx').on(t.organizationId)],
);

/**
 * Cola de aprobaciones (ARK-ARCH-002, regla transversal).
 * Toda acción con efecto externo se propone aquí y solo se ejecuta tras la decisión del owner.
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actionType: text('action_type').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    proposedBy: text('proposed_by').notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: approvalStatus('status').notNull().default('pendiente'),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('approvals_status_idx').on(t.status)],
);

/** Bitácora: cada acción de personas o agentes queda registrada (ARK-ARCH-002, C-07). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id'),
    detail: jsonb('detail').notNull().default({}),
  },
  (t) => [index('audit_log_subject_idx').on(t.subjectType, t.subjectId)],
);

/* ───────────── Contratos siguientes (ARK-ARCH-002): proyectos, entregables, reuniones, facturas, decisiones ───────────── */

export const projectPhase = pgEnum('project_phase', ['evaluar', 'arquitectar', 'modernizar', 'escalar']);

export const milestoneStatus = pgEnum('milestone_status', ['pendiente', 'en_curso', 'completado']);

export const deliverableStatus = pgEnum('deliverable_status', ['en_revision', 'publicado', 'con_correcciones', 'aprobado']);

export const correctionStatus = pgEnum('correction_status', ['abierta', 'resuelta']);

export const meetingStatus = pgEnum('meeting_status', ['solicitada', 'confirmada', 'realizada', 'rechazada', 'cancelada']);

/** Estado de la sincronización con Google Calendar (vía n8n). */
export const calendarStatus = pgEnum('calendar_status', ['sincronizada', 'pendiente', 'no_configurada', 'cancelada']);

export const invoiceStatus = pgEnum('invoice_status', ['borrador', 'enviada', 'pagada', 'anulada']);

/** Proyecto de una organización (F-05). El cliente solo ve sus hitos y avances, nunca tareas internas. */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    serviceFamily: serviceFamily('service_family').notNull().default('unknown'),
    phase: projectPhase('phase').notNull().default('evaluar'),
    progress: text('progress').notNull().default(''),
    nextStep: text('next_step').notNull().default(''),
    /** Archivado: deja de aparecer en las listas, pero el proyecto y su historial se conservan. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_organization_idx').on(t.organizationId)],
);

/** Hito con fecha prevista (D-21). Cambiar la fecha deja marca para avisar al cliente. */
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    status: milestoneStatus('status').notNull().default('pendiente'),
    plannedDate: timestamp('planned_date', { withTimezone: true }),
    dateChangedAt: timestamp('date_changed_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('milestones_project_idx').on(t.projectId)],
);

/**
 * Entregable (F-08). El contenido se guarda en la base en esta fase; en producción pasa a almacenamiento
 * de archivos sin cambiar la API. Solo se descarga cuando está publicado.
 */
export const deliverables = pgTable(
  'deliverables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    version: integer('version').notNull().default(1),
    status: deliverableStatus('status').notNull().default('en_revision'),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    content: bytea('content'),
    contentSha256: text('content_sha256'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deliverables_project_idx').on(t.projectId)],
);

/** Corrección que deja el cliente sobre un entregable (A-03). Pasa a revisión; no se aplica sola. */
export const corrections = pgTable(
  'corrections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deliverableId: uuid('deliverable_id')
      .notNull()
      .references(() => deliverables.id),
    authorId: text('author_id').notNull(),
    text: text('text').notNull(),
    status: correctionStatus('status').notNull().default('abierta'),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('corrections_deliverable_idx').on(t.deliverableId)],
);

/** Reunión: el cliente pide, el owner confirma y publica el acta (F-03, A-04, F-09, A-05). */
export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Reunión con un cliente. Vacío cuando la reunión es con un lead (prospecto) todavía sin organización. */
    organizationId: uuid('organization_id').references(() => organizations.id),
    /** Reunión con un prospecto. Vacío cuando es con un cliente. */
    leadId: uuid('lead_id').references(() => leads.id),
    projectId: uuid('project_id').references(() => projects.id),
    topic: text('topic').notNull(),
    status: meetingStatus('status').notNull().default('solicitada'),
    requestedBy: text('requested_by').notNull(),
    preferredWindows: jsonb('preferred_windows').notNull().default([]),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    /** Correos invitados además del contacto principal. */
    attendees: jsonb('attendees').$type<string[]>().notNull().default([]),
    /** Hora que el owner propone cuando no acepta la solicitud tal como llegó. */
    proposedStartsAt: timestamp('proposed_starts_at', { withTimezone: true }),
    /** Motivo del rechazo, de la propuesta o de la cancelación. */
    decisionNote: text('decision_note'),
    calendarEventId: text('calendar_event_id'),
    calendarStatus: calendarStatus('calendar_status'),
    calendarLink: text('calendar_link'),
    meetLink: text('meet_link'),
    /** Cuándo se envió el recordatorio previo a la reunión. Vacío mientras no se haya enviado. */
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    /** Borrado lógico: la reunión deja de aparecer, pero su registro y su bitácora se conservan. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    minutesText: text('minutes_text'),
    minutesPublishedAt: timestamp('minutes_published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('meetings_organization_idx').on(t.organizationId), index('meetings_lead_idx').on(t.leadId)],
);

/** Supresión: correos que no deben recibir ningún contacto de Arkanium (consentimiento y baja). */
export const suppressions = pgTable('suppressions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Factura (F-10). Se emite en Stripe; el pago ocurre en la página segura de Stripe. */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),
    number: text('number').notNull(),
    concept: text('concept').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    dueDays: integer('due_days').notNull().default(30),
    /** Correo al que se envía esta factura. Vacío: el correo de facturación de la organización. */
    recipientEmail: text('recipient_email'),
    status: invoiceStatus('status').notNull().default('borrador'),
    stripeInvoiceId: text('stripe_invoice_id'),
    hostedUrl: text('hosted_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Borrador descartado. Borrado lógico: el número no se reutiliza. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invoices_number_uq').on(t.number), index('invoices_organization_idx').on(t.organizationId)],
);

/** Líneas de una factura. El monto total de la factura es la suma de cantidad × precio unitario. */
export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitAmountCents: integer('unit_amount_cents').notNull(),
  },
  (t) => [index('invoice_lines_invoice_idx').on(t.invoiceId)],
);

/** Notas de crédito sobre una factura pagada. Se suman; nunca se editan ni se borran. */
export const invoiceCreditNotes = pgTable(
  'invoice_credit_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason').notNull(),
    stripeCreditNoteId: text('stripe_credit_note_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invoice_credit_notes_invoice_idx').on(t.invoiceId)],
);

/**
 * Registro de decisiones del cliente: qué aprobó, corrigió o firmó, con su texto exacto (app → Decisiones).
 * Solo se agrega: una decisión nueva nunca edita la anterior.
 */
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),
    kind: text('kind').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    text: text('text').notNull(),
    actorId: text('actor_id').notNull(),
    actorRole: text('actor_role').notNull(),
    documentSha256: text('document_sha256'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('decisions_organization_idx').on(t.organizationId)],
);

export const proposalStatus = pgEnum('proposal_status', ['borrador', 'en_aprobacion', 'enviada', 'aceptada', 'rechazada']);
export const proposalPriceStatus = pgEnum('proposal_price_status', ['por_confirmar', 'confirmado']);

/** Propuesta para un lead o un cliente. Ninguna sale sin aprobación del owner; el precio debe estar confirmado para enviarla. */
export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    leadId: uuid('lead_id').references(() => leads.id),
    title: text('title').notNull(),
    serviceFamily: serviceFamily('service_family').notNull().default('unknown'),
    templateCode: text('template_code').notNull(),
    status: proposalStatus('status').notNull().default('borrador'),
    currentVersion: integer('current_version').notNull().default(1),
    /** Motivo del rechazo o referencia de la firma de aceptación. */
    decisionNote: text('decision_note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('proposals_organization_idx').on(t.organizationId), index('proposals_lead_idx').on(t.leadId)],
);

/** Versión de una propuesta: cada cambio de texto o precio crea una versión nueva. Una versión enviada no se edita. */
export const proposalVersions = pgTable(
  'proposal_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id),
    version: integer('version').notNull(),
    summary: text('summary').notNull(),
    priceStatus: proposalPriceStatus('price_status').notNull().default('por_confirmar'),
    priceCents: integer('price_cents'),
    priceNote: text('price_note'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('proposal_versions_unique_idx').on(t.proposalId, t.version)],
);
