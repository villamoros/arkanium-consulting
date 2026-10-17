/**
 * POST /api/contact — Cloudflare Pages Function (ver docs/ark-web-cta-intake-phase1.md).
 * Orden: origen → tamaño → validación → correo a hello@ (registro oficial) → alerta a Slack.
 * Nunca responde éxito si el correo no salió. Si Slack falla después, el lead ya está guardado en el correo.
 * Después del correo, el lead también se registra en la API de Arkanium (Leads de core).
 * Si la API no responde, el lead ya está en el correo: el visitante recibe éxito igualmente y el fallo se registra.
 * Secretos solo como variables del proyecto en Cloudflare: RESEND_API_KEY, LEAD_EMAIL_FROM, LEAD_EMAIL_TO, SLACK_WEBHOOK_URL, LEAD_INTAKE_TOKEN.
 * Variable pública: ARKANIUM_API_URL (dirección de la API, sin secreto).
 */
import { parseLead, LIMITS } from '../../src/lib/contact/lead.ts';
import { leadEmail, slackAlert } from '../../src/lib/contact/compose.ts';
import type { Lead } from '../../src/lib/contact/lead.ts';

interface Env {
  RESEND_API_KEY?: string;
  LEAD_EMAIL_FROM?: string;
  LEAD_EMAIL_TO?: string;
  SLACK_WEBHOOK_URL?: string;
  LEAD_INTAKE_TOKEN?: string;
  ARKANIUM_API_URL?: string;
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
    ...(context ? { context } : {}),
  };
}

function forwardToPlatform(lead: Lead, env: Env): Promise<Response> {
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
  // Campo trampa lleno: respuesta de éxito sin enviar nada, para no avisar al bot.
  if (parsed.kind === 'spam') return json(200, { ok: true });
  if (parsed.kind === 'invalid') return json(400, { ok: false, error: 'invalid', field: parsed.field });

  if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_FROM || !env.LEAD_EMAIL_TO) {
    console.error('contact: correo no configurado');
    return json(503, { ok: false, error: 'not_configured' });
  }

  const mail = leadEmail(parsed.lead);
  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.LEAD_EMAIL_FROM,
      to: [env.LEAD_EMAIL_TO],
      reply_to: parsed.lead.email,
      subject: mail.subject,
      text: mail.text,
    }),
  }).catch(() => null);

  if (!mailRes || !mailRes.ok) {
    console.error(`contact: envío de correo fallido (${mailRes?.status ?? 'red'})`);
    return json(502, { ok: false, error: 'email_failed' });
  }

  // Registro en la plataforma: el lead queda en Leads de core. Un fallo aquí no cambia la respuesta al visitante.
  if (env.ARKANIUM_API_URL && env.LEAD_INTAKE_TOKEN) {
    const apiRes = await forwardToPlatform(parsed.lead, env).catch(() => null);
    if (!apiRes || !apiRes.ok) console.error(`contact: registro en la API fallido (${apiRes?.status ?? 'red'})`);
  }

  if (env.SLACK_WEBHOOK_URL) {
    const slackRes = await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: slackAlert(parsed.lead) }),
    }).catch(() => null);
    if (!slackRes || !slackRes.ok) console.error(`contact: alerta de Slack fallida (${slackRes?.status ?? 'red'})`);
  }

  return json(200, { ok: true });
}
