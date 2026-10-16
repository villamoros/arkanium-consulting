import { z } from 'zod';

/** Familias del catálogo. Se usan para proyectos y leads. */
export const serviceFamilyValues = ['architecture', 'strategy', 'product', 'unknown'] as const;
export const projectPhaseValues = ['evaluar', 'arquitectar', 'modernizar', 'escalar'] as const;
export const milestoneStatusValues = ['pendiente', 'en_curso', 'completado'] as const;
export const deliverableStatusValues = ['en_revision', 'publicado', 'con_correcciones', 'aprobado'] as const;
export const meetingStatusValues = ['solicitada', 'confirmada', 'realizada'] as const;
export const invoiceStatusValues = ['borrador', 'enviada', 'pagada', 'anulada'] as const;
export const memberRoleValues = ['org:admin', 'org:member'] as const;

/** F-05: el owner abre un proyecto para una organización. */
export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  serviceFamily: z.enum(serviceFamilyValues).default('unknown'),
  phase: z.enum(projectPhaseValues).default('evaluar'),
  progress: z.string().trim().max(500).default(''),
  nextStep: z.string().trim().max(300).default(''),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

/** Hito con fecha prevista. Las fechas son previstas (D-21). */
export const milestoneCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  plannedDate: z.iso.datetime().optional(),
});
export type MilestoneCreate = z.infer<typeof milestoneCreateSchema>;

export const milestoneUpdateSchema = z
  .object({
    status: z.enum(milestoneStatusValues).optional(),
    plannedDate: z.iso.datetime().nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.plannedDate !== undefined, 'Indica un estado o una fecha.');
export type MilestoneUpdate = z.infer<typeof milestoneUpdateSchema>;

/** F-08: el owner registra un entregable. El archivo se sube aparte. */
export const deliverableCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
});
export type DeliverableCreate = z.infer<typeof deliverableCreateSchema>;

/** Contenido del archivo en base64. Límite de 5 MB en esta fase. */
export const deliverableContentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(120),
  contentBase64: z.string().min(1).max(7_000_000),
});
export type DeliverableContent = z.infer<typeof deliverableContentSchema>;

/** A-03: el cliente deja una corrección. No se aplica sola. */
export const correctionCreateSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});
export type CorrectionCreate = z.infer<typeof correctionCreateSchema>;

export const correctionResolveSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});
export type CorrectionResolve = z.infer<typeof correctionResolveSchema>;

/** A-02: el administrador del cliente aprueba un entregable con su texto exacto. */
export const deliverableApprovalSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
export type DeliverableApproval = z.infer<typeof deliverableApprovalSchema>;

/** F-03 y A-04: el cliente pide una reunión con ventanas preferidas. */
export const meetingRequestSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  projectId: z.uuid().optional(),
  preferredWindows: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
});
export type MeetingRequest = z.infer<typeof meetingRequestSchema>;

/** F-03: el owner confirma la reunión con su fecha. */
export const meetingConfirmSchema = z.object({
  startsAt: z.iso.datetime(),
});
export type MeetingConfirm = z.infer<typeof meetingConfirmSchema>;

/** A-05: el owner publica el acta; queda visible para el cliente. */
export const minutesPublishSchema = z.object({
  text: z.string().trim().min(1).max(20000),
});
export type MinutesPublish = z.infer<typeof minutesPublishSchema>;

/** F-10: borrador de factura, emitido después desde core. Montos en centavos de USD. */
export const invoiceDraftSchema = z.object({
  projectId: z.uuid().optional(),
  concept: z.string().trim().min(1).max(140),
  amountCents: z.number().int().positive().max(100_000_000),
  dueDays: z.number().int().min(1).max(90).default(30),
});
export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;

/** Cambio de rol de un miembro. Solo administradores de la organización o el owner. */
export const memberRoleSchema = z.object({
  role: z.enum(memberRoleValues),
});
export type MemberRole = z.infer<typeof memberRoleSchema>;

/** Suspensión de una organización con motivo, que queda en la bitácora. */
export const organizationSuspendSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type OrganizationSuspend = z.infer<typeof organizationSuspendSchema>;
