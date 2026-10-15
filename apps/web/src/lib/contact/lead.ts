/**
 * Validación del formulario de contacto. Se ejecuta en el navegador (mensajes) y en el endpoint (fuente de verdad).
 * El servidor no confía en la validación del cliente. Sin dependencias: se usa también dentro de una Pages Function.
 */

/** Prioridades permitidas: slugs de familia de servicio + «no estoy seguro». Debe coincidir con content/services (ver test-contact). */
export const PRIORITY_VALUES = ['strategy', 'product', 'architecture', 'unsure'] as const;
export const LOCALE_VALUES = ['en', 'es', 'pt', 'fr'] as const;

export const LIMITS = { name: 120, email: 254, context: 2000, slug: 80, bodyBytes: 16 * 1024 } as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Lead {
  name: string;
  email: string;
  priority: string;
  service?: string;
  offering?: string;
  context: string;
  locale: string;
  receivedAt: string;
}

export type LeadParse =
  | { kind: 'ok'; lead: Lead }
  | { kind: 'spam' }
  | { kind: 'invalid'; field: string };

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Valida un envío. Si el campo trampa (`website`) tiene contenido, es un bot: se descarta sin error. */
export function parseLead(raw: unknown, now: Date = new Date()): LeadParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'invalid', field: 'body' };
  const body = raw as Record<string, unknown>;

  if (text(body.website) !== '') return { kind: 'spam' };

  const name = text(body.name);
  if (!name || name.length > LIMITS.name) return { kind: 'invalid', field: 'name' };

  const email = text(body.email);
  if (!EMAIL.test(email) || email.length > LIMITS.email) return { kind: 'invalid', field: 'email' };

  const priority = text(body.priority);
  if (!(PRIORITY_VALUES as readonly string[]).includes(priority)) return { kind: 'invalid', field: 'priority' };

  const context = text(body.context);
  if (context.length > LIMITS.context) return { kind: 'invalid', field: 'context' };

  const locale = text(body.locale);
  if (!(LOCALE_VALUES as readonly string[]).includes(locale)) return { kind: 'invalid', field: 'locale' };

  if (body.consent !== true) return { kind: 'invalid', field: 'consent' };

  const service = text(body.service);
  const offering = text(body.offering);
  if ((service && (service.length > LIMITS.slug || !SLUG.test(service))) || (offering && (offering.length > LIMITS.slug || !SLUG.test(offering)))) {
    // Un contexto comercial inválido se descarta; no rechaza al lead.
    return { kind: 'ok', lead: { name, email, priority, context, locale, receivedAt: now.toISOString() } };
  }

  return {
    kind: 'ok',
    lead: {
      name,
      email,
      priority,
      ...(service ? { service } : {}),
      ...(offering ? { offering } : {}),
      context,
      locale,
      receivedAt: now.toISOString(),
    },
  };
}
