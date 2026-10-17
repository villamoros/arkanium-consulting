import { z } from 'zod';

/** F-01: captación de un lead desde el sitio público. */
export const leadIntakeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
  priority: z.string().trim().min(1).max(60),
  context: z.string().trim().max(2000).optional(),
  locale: z.enum(['es', 'en', 'fr', 'pt']),
  source: z.string().trim().max(60).default('website'),
});
export type LeadIntake = z.infer<typeof leadIntakeSchema>;

/** F-02: decisión del owner sobre un lead. El agente solo propone. */
export const leadDecisionSchema = z
  .object({
    decision: z.enum(['calificar', 'posponer', 'descartar']),
    reason: z.string().trim().min(1).max(1000),
    /** Obligatoria al posponer: cuándo volver a revisar el lead. */
    revisitAt: z.iso.datetime().optional(),
  })
  .refine((value) => value.decision !== 'posponer' || Boolean(value.revisitAt), {
    message: 'Indica cuándo volver a revisar el lead.',
    path: ['revisitAt'],
  });
export type LeadDecision = z.infer<typeof leadDecisionSchema>;

/** F-02: el owner acepta o rechaza la propuesta del agente de calificación. Solo queda registrado. */
export const leadProposalSchema = z.object({
  accepted: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});
export type LeadProposal = z.infer<typeof leadProposalSchema>;

export const leadStatusValues = ['nuevo', 'calificado', 'pospuesto', 'descartado', 'convertido'] as const;

/** Forma de un lead que devuelve la API. */
export const leadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  company: z.string().nullable(),
  priorityChoice: z.string(),
  locale: z.string(),
  status: z.enum(leadStatusValues),
  receivedAt: z.string(),
  organizationId: z.string().uuid().nullable(),
  /** Mensaje que escribió la persona en el formulario. */
  context: z.string().nullable(),
  /** Origen de la captación (por ejemplo, website). */
  source: z.string(),
  /** Perfil o enlace de origen (redes sociales y mensajes directos). */
  sourceReference: z.string().nullable(),
  /** Propuesta del agente de calificación: solo sugiere; la decisión es del owner. */
  proposedFamily: z.enum(['architecture', 'strategy', 'product', 'unknown']).nullable(),
  proposedReason: z.string().nullable(),
  /** Motivo que escribió el owner al calificar, posponer o descartar. */
  decisionNote: z.string().nullable(),
  /** Cuándo volver a revisar el lead pospuesto. */
  revisitAt: z.string().nullable(),
});
export type Lead = z.infer<typeof leadSchema>;

/** D-03: invitación de una persona a una organización. La envía el owner desde core. */
export const memberInvitationSchema = z.object({
  email: z.email().max(254),
  role: z.enum(['org:admin', 'org:member']),
});
export type MemberInvitation = z.infer<typeof memberInvitationSchema>;

/** Orígenes de un lead que no llega por formulario: redes sociales y captación manual. */
export const leadSourceValues = ['website', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'x', 'mensaje-directo', 'referido', 'evento', 'otro'] as const;

/** Alta manual de un lead (owner): mensaje directo, comentario, referido o evento. */
export const leadManualSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
  priority: z.string().trim().min(1).max(60).default('unsure'),
  context: z.string().trim().max(2000).optional(),
  locale: z.enum(['es', 'en', 'fr', 'pt']).default('es'),
  source: z.enum(leadSourceValues),
  /** Perfil o enlace de origen, por ejemplo el usuario de la red social. */
  sourceReference: z.string().trim().max(300).optional(),
});
export type LeadManual = z.infer<typeof leadManualSchema>;

/** Edición de los datos de un lead (owner). Solo los campos enviados cambian. */
export const leadUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().max(254).optional(),
    company: z.string().trim().max(160).nullable().optional(),
    priority: z.string().trim().min(1).max(60).optional(),
    context: z.string().trim().max(2000).nullable().optional(),
    source: z.enum(leadSourceValues).optional(),
    sourceReference: z.string().trim().max(300).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Indica al menos un dato para cambiar.');
export type LeadUpdate = z.infer<typeof leadUpdateSchema>;

/** Eliminación de un lead (owner). El motivo queda en la bitácora. */
export const leadDeleteSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type LeadDelete = z.infer<typeof leadDeleteSchema>;
