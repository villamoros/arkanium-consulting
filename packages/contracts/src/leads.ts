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
export const leadDecisionSchema = z.object({
  decision: z.enum(['calificar', 'posponer', 'descartar']),
  reason: z.string().trim().min(1).max(1000),
});
export type LeadDecision = z.infer<typeof leadDecisionSchema>;

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
});
export type Lead = z.infer<typeof leadSchema>;

/** D-03: invitación de una persona a una organización. La envía el owner desde core. */
export const memberInvitationSchema = z.object({
  email: z.email().max(254),
  role: z.enum(['org:admin', 'org:member']),
});
export type MemberInvitation = z.infer<typeof memberInvitationSchema>;
