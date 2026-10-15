/**
 * POST /api/contact — Cloudflare Pages Function (ver docs/ark-web-cta-intake-phase1.md).
 * Orden: origen → tamaño → validación → correo a hello@ (registro oficial) → alerta a Slack.
 * Nunca responde éxito si el correo no salió. Si Slack falla después, el lead ya está guardado en el correo.
 * Secretos solo como variables del proyecto en Cloudflare: RESEND_API_KEY, LEAD_EMAIL_FROM, LEAD_EMAIL_TO, SLACK_WEBHOOK_URL.
 */
import { parseLead, LIMITS } from '../../src/lib/contact/lead.ts';
import { leadEmail, slackAlert } from '../../src/lib/contact/compose.ts';

interface Env {
  RESEND_API_KEY?: string;
  LEAD_EMAIL_FROM?: string;
  LEAD_EMAIL_TO?: string;
  SLACK_WEBHOOK_URL?: string;
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
