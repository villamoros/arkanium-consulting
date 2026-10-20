import { z } from 'zod';
import { leadSourceValues } from './leads.js';

/** Mercadeo (Core): campañas, landing pages, buyer personas, contactos y artículos de Insights. */

export const campaignStatusValues = ['borrador', 'activa', 'pausada', 'cerrada'] as const;
export const personaStatusValues = ['activo', 'pausado'] as const;
export const articleStatusValues = ['borrador', 'en_revision', 'publicado'] as const;
export const articleLangValues = ['es', 'en', 'fr', 'pt'] as const;
/** Límite de contactos directos por día, en total y entre todos los perfiles (ARK-ARCH-003 y diseño de Mercadeo). */
export const DAILY_CONTACT_CAP = 10;

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  service: z.string().trim().min(1).max(120),
  buyerPersonaId: z.uuid().optional(),
  status: z.enum(campaignStatusValues).default('borrador'),
});
export type CampaignCreate = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(120).optional(),
  buyerPersonaId: z.uuid().nullable().optional(),
  status: z.enum(campaignStatusValues).optional(),
});

export const landingCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.url().max(300).optional(),
  campaignId: z.uuid().optional(),
});

export const landingUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  url: z.url().max(300).nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
});

export const personaCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.string().trim().min(1).max(300),
  service: z.string().trim().min(1).max(120),
  channel: z.enum(leadSourceValues),
  note: z.string().trim().max(1000).optional(),
});
export type PersonaCreate = z.infer<typeof personaCreateSchema>;

export const personaUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  segment: z.string().trim().min(1).max(300).optional(),
  service: z.string().trim().min(1).max(120).optional(),
  channel: z.enum(leadSourceValues).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(personaStatusValues).optional(),
});

/** Contacto directo que el equipo ya hizo con el perfil. Se registra después, no se envía desde aquí. */
export const personaContactSchema = z.object({
  channel: z.enum(leadSourceValues),
  note: z.string().trim().min(1).max(500),
});

/** Pasar un perfil a Leads: el correo es obligatorio, el resto viene del perfil. */
export const personaConvertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
});

export const articleCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  excerpt: z.string().trim().max(300).optional(),
  caseRef: z.string().trim().max(160).optional(),
  langs: z.array(z.enum(articleLangValues)).min(1).max(4),
});
export type ArticleCreate = z.infer<typeof articleCreateSchema>;

/** Cuerpo del artículo: documento del editor (TipTap). Tiene un límite de tamaño para no guardar textos desmedidos. */
export const articleBodySchema = z
  .object({ type: z.literal('doc') })
  .passthrough()
  .refine((body) => JSON.stringify(body).length <= 200_000, 'El artículo es demasiado largo.');

export const articleContentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(300).optional(),
  body: articleBodySchema,
});
export type ArticleContent = z.infer<typeof articleContentSchema>;

export const articleUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  excerpt: z.string().trim().max(300).nullable().optional(),
  caseRef: z.string().trim().max(160).nullable().optional(),
  langs: z.array(z.enum(articleLangValues)).min(1).max(4).optional(),
  /** Contenido de uno o varios idiomas. Escribir en un idioma nuevo lo añade a los idiomas del artículo. */
  content: z.partialRecord(z.enum(articleLangValues), articleContentSchema).optional(),
});

/** Redes donde se publican las piezas. */
export const adNetworkValues = ['linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const;
export const pieceFormatValues = ['texto', 'imagen', 'video', 'carrusel'] as const;
export const briefObjectiveValues = ['leads', 'reuniones', 'reconocimiento'] as const;

/**
 * Brief de la campaña: las instrucciones que el agente necesita para producir las piezas.
 * Se revisa y se aprueba antes de que se produzca nada.
 */
export const campaignBriefSchema = z.object({
  objective: z.enum(briefObjectiveValues),
  message: z.string().trim().min(1).max(500),
  cta: z.string().trim().min(1).max(120),
  constraints: z.string().trim().max(1000).nullable().optional(),
  kpis: z.string().trim().max(300).nullable().optional(),
  budgetCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  networks: z.array(z.enum(adNetworkValues)).min(1).max(6),
  personaIds: z.array(z.uuid()).min(1).max(20),
});
export type CampaignBrief = z.infer<typeof campaignBriefSchema>;

/** Tipos de canal de una campaña. Las redes del brief son canales de tipo red social. */
export const channelKindValues = ['red_social', 'newsletter', 'landing', 'anuncio_pagado'] as const;

/** Canal nuevo de una campaña. Las fechas son AAAA-MM-DD y el fin no puede ser antes del inicio. */
export const channelCreateSchema = z
  .object({
    kind: z.enum(channelKindValues),
    platform: z.string().trim().min(1).max(60),
    budgetCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    startsOn: z.iso.date().nullable().optional(),
    endsOn: z.iso.date().nullable().optional(),
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn, {
    message: 'La fecha de fin no puede ser anterior a la de inicio.',
    path: ['endsOn'],
  });
export type ChannelCreate = z.infer<typeof channelCreateSchema>;

/** Redes del brief más el newsletter, que sale por canal y no por red social. */
export const pieceNetworkValues = [...adNetworkValues, 'newsletter'] as const;

export const pieceCreateSchema = z.object({
  network: z.enum(pieceNetworkValues),
  format: z.enum(pieceFormatValues),
  copy: z.string().trim().min(1).max(1500),
  assetUrl: z.url().max(500).optional(),
});

export const pieceUpdateSchema = z.object({
  format: z.enum(pieceFormatValues).optional(),
  copy: z.string().trim().min(1).max(1500).optional(),
  assetUrl: z.url().max(500).nullable().optional(),
});
export type PieceCreate = z.infer<typeof pieceCreateSchema>;
export type PieceUpdate = z.infer<typeof pieceUpdateSchema>;
