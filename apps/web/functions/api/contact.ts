/**
 * POST /api/contact — Cloudflare Pages Function (ver docs/ark-web-cta-intake-phase1.md).
 * Orden: origen → tamaño → validación → registro del lead en la API de Arkanium → respuesta.
 * El lead se guarda antes de cualquier aviso. El correo y Slack los envía n8n desde la cola de avisos de la API.
 * Si la API no guarda el lead, el visitante recibe un error: nada se pierde en silencio.
 * Secretos: solo LEAD_INTAKE_TOKEN, como variable del proyecto en Cloudflare. ARKANIUM_API_URL es pública.
 */
import { parseLead, LIMITS, CONSENT_TEXT_VERSION } from '../../src/lib/contact/lead.ts';
import type { Lead } from '../../src/lib/contact/lead.ts';

interface Env {
  ARKANIUM_API_URL?: string;
  LEAD_INTAKE_TOKEN?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Campos del lead tal como los acepta POST /leads de la API. El origen del lead es el sitio. */
export function platformPayload(lead: Lead): Record<string, unknown> {
  const extra = [lead.service && `Servicio: ${lead.service}`, lead.offering && `Oferta: ${lead.offering}`].filter(Boolean);
  const context = [lead.context, ...extra].filter(Boolean).join('\n').slice(0, 2000);
  return {
    name: lead.name,
    email: lead.email,
    priority: lead.priority,
    locale: lead.locale,
    source: 'website',
    consent: { accepted: true, textVersion: CONSENT_TEXT_VERSION },
    ...(context ? { context } : {}),
  };
}

function saveLead(lead: Lead, env: Env): Promise<Response> {
  return fetch(`${env.ARKANIUM_API_URL}/leads`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.LEAD_INTAKE_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(platformPayload(lead)),
  });
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { ok: false, error: 'forbidden' });

  if (!request.headers.get('content-type')?.includes('application/json')) return json(415, { ok: false, error: 'unsupported_media_type' });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return json(413, { ok: false, error: 'too_large' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'invalid', field: 'body' });
  }

  const parsed = parseLead(body);
  // Campo trampa lleno: respuesta de éxito sin guardar nada, para no avisar al bot.
  if (parsed.kind === 'spam') return json(200, { ok: true });
  if (parsed.kind === 'invalid') return json(400, { ok: false, error: 'invalid', field: parsed.field });

  if (!env.ARKANIUM_API_URL || !env.LEAD_INTAKE_TOKEN) {
    console.error('contact: API de Arkanium no configurada');
    return json(503, { ok: false, error: 'not_configured' });
  }

  // Primero se guarda el lead. Sin registro no hay éxito: el visitante puede volver a intentarlo.
  const saved = await saveLead(parsed.lead, env).catch(() => null);
  if (!saved || !saved.ok) {
    console.error(`contact: el lead no se guardó (${saved?.status ?? 'red'})`);
    return json(503, { ok: false, error: 'not_saved' });
  }

  return json(200, { ok: true });
}
