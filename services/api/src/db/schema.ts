/**
 * Esquema de la base de datos. Fuente: ARK-ARCH-001 (entidades) y ARK-ARCH-002 (flujos).
 * Primer contrato: F-01 captar lead, F-02 calificar, F-04 convertir en organización.
 * Además: cola de aprobaciones y bitácora, porque ninguna acción externa ocurre sin ellas.
 *
 * SQL estándar: el mismo esquema funciona en PostgreSQL local y en Supabase.
 */
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const organizationKind = pgEnum('organization_kind', ['internal', 'client']);

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
    campaignId: uuid('campaign_id').references(() => campaigns.id),
    buyerPersonaId: uuid('buyer_persona_id').references(() => buyerPersonas.id),
    status: leadStatus('status').notNull().default('nuevo'),
    /** Propuesta del agente de calificación (F-02). Solo informa; la decisión la toma el owner. */
    proposedFamily: serviceFamily('proposed_family').default('unknown'),
    proposedReason: text('proposed_reason'),
    /** Motivo de la decisión del owner (calificar, posponer o descartar). */
    decisionNote: text('decision_note'),
    organizationId: uuid('organization_id').references(() => organizations.id),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
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
