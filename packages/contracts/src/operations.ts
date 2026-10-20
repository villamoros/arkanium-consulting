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
  /** Duración en minutos para el evento del calendario. Si se omite, son 60. */
  durationMinutes: z.number().int().min(15).max(480).optional(),
  /** Correos invitados además del contacto principal o del lead. */
  attendees: z.array(z.email().max(254)).max(10).default([]),
});
export type MeetingConfirm = z.infer<typeof meetingConfirmSchema>;

/** El owner rechaza una solicitud. El motivo queda registrado. */
export const meetingRejectSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type MeetingReject = z.infer<typeof meetingRejectSchema>;

/** El owner no acepta la hora pedida y propone otra. El cliente la verá cuando exista su pantalla. */
export const meetingProposeSchema = z.object({
  startsAt: z.iso.datetime(),
  note: z.string().trim().max(1000).optional(),
});
export type MeetingPropose = z.infer<typeof meetingProposeSchema>;

/** El owner cancela una reunión confirmada. El evento se quita del calendario. */
export const meetingCancelSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type MeetingCancel = z.infer<typeof meetingCancelSchema>;

/** El owner mueve una reunión confirmada a otra hora. El evento se actualiza en el calendario. */
export const meetingRescheduleSchema = z.object({
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
});
export type MeetingReschedule = z.infer<typeof meetingRescheduleSchema>;

/** Reunión con un lead (prospecto) antes de convertirlo en cliente. */
export const leadMeetingSchema = z.object({
  topic: z.string().trim().min(1).max(200),
});
export type LeadMeeting = z.infer<typeof leadMeetingSchema>;

/** Supresión: un correo que no debe recibir contactos de Arkanium. */
export const suppressionSchema = z.object({
  email: z.email().max(254),
  reason: z.string().trim().min(1).max(500),
});
export type Suppression = z.infer<typeof suppressionSchema>;

/** A-05: el owner publica el acta; queda visible para el cliente. */
export const minutesPublishSchema = z.object({
  text: z.string().trim().min(1).max(20000),
});
export type MinutesPublish = z.infer<typeof minutesPublishSchema>;

/** Una línea de factura: cantidad × precio unitario, en centavos de USD. */
export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(140),
  quantity: z.number().int().min(1).max(10_000),
  unitAmountCents: z.number().int().positive().max(100_000_000),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

/** F-10: borrador de factura, emitido después desde core. El total se calcula con las líneas. */
export const invoiceDraftSchema = z.object({
  projectId: z.uuid().optional(),
  concept: z.string().trim().min(1).max(140),
  lines: z.array(invoiceLineSchema).min(1).max(20),
  dueDays: z.number().int().min(1).max(90).default(30),
  /** Correo al que Stripe envía la factura. Vacío usa el correo de facturación de la organización. */
  recipientEmail: z.email().max(254).optional(),
});
export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;

/** Pausa de emergencia: el motivo queda en la bitácora. Al reanudar es opcional. */
export const emergencyPauseSchema = z.object({
  reason: z.string().trim().min(1).max(140),
});
export const emergencyResumeSchema = z.object({
  reason: z.string().trim().max(140).optional(),
});

/** Correo donde Stripe envía la factura. Vacío lo borra. */
export const billingEmailSchema = z.object({
  billingEmail: z.union([z.email().max(254), z.literal('')]).transform((value) => (value === '' ? null : value.toLowerCase())),
});
export type BillingEmail = z.infer<typeof billingEmailSchema>;

/** Nota de crédito sobre una factura pagada: devuelve el monto al cliente desde Stripe. */
export const creditNoteSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),
  reason: z.string().trim().min(1).max(140),
});
export type CreditNote = z.infer<typeof creditNoteSchema>;

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

/**
 * Gestión manual de una reunión (owner), para cuando n8n o Calendar fallan o hay que corregir algo.
 * Con fecha queda confirmada y se intenta crear el evento; sin fecha queda como solicitud.
 */
export const meetingManualSchema = z
  .object({
    kind: z.enum(['cliente', 'lead']),
    organizationId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    topic: z.string().trim().min(1).max(200),
    startsAt: z.iso.datetime().optional(),
    durationMinutes: z.number().int().min(15).max(480).optional(),
    attendees: z.array(z.email().max(254)).max(10).default([]),
  })
  .refine((value) => (value.kind === 'cliente' ? Boolean(value.organizationId) : Boolean(value.leadId)), {
    message: 'Indica el cliente o el lead de la reunión.',
  });
export type MeetingManual = z.infer<typeof meetingManualSchema>;

/** Cambios manuales de una reunión. Si cambia la hora y el calendario falla, se guarda solo con skipCalendar. */
export const meetingUpdateSchema = z
  .object({
    topic: z.string().trim().min(1).max(200).optional(),
    attendees: z.array(z.email().max(254)).max(10).optional(),
    startsAt: z.iso.datetime().optional(),
    durationMinutes: z.number().int().min(15).max(480).optional(),
    skipCalendar: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'skipCalendar' && value[key as keyof typeof value] !== undefined), {
    message: 'Indica al menos un dato para cambiar.',
  });
export type MeetingUpdate = z.infer<typeof meetingUpdateSchema>;

/** Eliminar una reunión: se conserva el registro (borrado lógico). Si el evento no se puede quitar, solo con force. */
export const meetingDeleteSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  force: z.boolean().optional(),
});
export type MeetingDelete = z.infer<typeof meetingDeleteSchema>;

/** Cambios de un proyecto (owner). Solo se envían los campos que cambian. */
export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    serviceFamily: z.enum(serviceFamilyValues).optional(),
    phase: z.enum(projectPhaseValues).optional(),
    progress: z.string().trim().max(500).optional(),
    nextStep: z.string().trim().max(300).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), 'Indica al menos un dato para cambiar.');
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/** Archivar un proyecto: deja de aparecer en las listas; el proyecto y su historial se conservan. */
export const projectArchiveSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ProjectArchive = z.infer<typeof projectArchiveSchema>;

/** Propuestas (Core): texto y precio por versión. El precio confirmado exige monto o una nota (p. ej. «Acordado en SOW»). */
export const proposalPriceStatusValues = ['por_confirmar', 'confirmado'] as const;
export const proposalStatusValues = ['borrador', 'en_aprobacion', 'enviada', 'aceptada', 'rechazada'] as const;

const priceRule = (value: { priceStatus: 'por_confirmar' | 'confirmado'; priceCents?: number; priceNote?: string }) =>
  value.priceStatus !== 'confirmado' || value.priceCents !== undefined || Boolean(value.priceNote);

const proposalVersionShape = {
  summary: z.string().trim().min(1).max(4000),
  priceStatus: z.enum(proposalPriceStatusValues),
  priceCents: z.number().int().min(0).max(1_000_000_000).optional(),
  priceNote: z.string().trim().max(200).optional(),
};

export const proposalVersionSchema = z
  .object(proposalVersionShape)
  .refine(priceRule, { message: 'Un precio confirmado necesita un monto o una nota de precio.', path: ['priceStatus'] });
export type ProposalVersion = z.infer<typeof proposalVersionSchema>;

export const proposalCreateSchema = z
  .object({
    kind: z.enum(['cliente', 'lead']),
    organizationId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    title: z.string().trim().min(1).max(160),
    serviceFamily: z.enum(serviceFamilyValues).default('unknown'),
    templateCode: z.string().trim().min(1).max(20),
    ...proposalVersionShape,
  })
  .refine((value) => (value.kind === 'cliente' ? Boolean(value.organizationId) : Boolean(value.leadId)), {
    message: 'Indica el cliente o el lead de la propuesta.',
  })
  .refine(priceRule, { message: 'Un precio confirmado necesita un monto o una nota de precio.', path: ['priceStatus'] });
export type ProposalCreate = z.infer<typeof proposalCreateSchema>;

/** Decisión sobre una propuesta enviada: motivo del rechazo o referencia de la firma de aceptación. */
export const proposalDecisionSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>;
