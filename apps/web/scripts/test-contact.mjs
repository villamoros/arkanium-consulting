/**
 * Pruebas del formulario de contacto: validación, composición y endpoint (fetch simulado, sin envíos reales).
 *   npm run test:contact
 */
import assert from 'node:assert/strict';
import { DEFAULT_CONTENT_ROOT } from '../src/lib/content/execute.ts';
import { groupServices } from '../src/lib/content/services.ts';
import { readCollection } from '../src/lib/content/store.ts';
import { CONSENT_TEXT_VERSION, PRIORITY_VALUES, parseLead } from '../src/lib/contact/lead.ts';
import { leadEmail, slackAlert } from '../src/lib/contact/compose.ts';
import { onRequestPost, platformPayload } from '../functions/api/contact.ts';

const NOW = new Date('2026-10-14T12:00:00Z');
const valid = { name: 'Ana Pérez', email: 'ana@empresa.com', priority: 'strategy', context: 'Necesitamos ordenar la deuda técnica.', locale: 'es', consent: true, website: '' };
const ENV = { RESEND_API_KEY: 'test-key', LEAD_EMAIL_FROM: 'web@arkanium.consulting', LEAD_EMAIL_TO: 'hello@arkanium.consulting', SLACK_WEBHOOK_URL: 'https://hooks.slack.test/abc' };

// fetch simulado: registra cada llamada y responde según el destino.
function fakeFetch(plan = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null, headers: init?.headers });
    const isMail = String(url).includes('resend');
    const isPlatform = String(url).includes('arkanium.test');
    const status = isMail ? (plan.resend ?? 200) : isPlatform ? (plan.platform ?? 201) : (plan.slack ?? 200);
    if (status === 'network') throw new Error('red caída');
    return new Response('{}', { status });
  };
  return calls;
}

function request(body, headers = {}) {
  return new Request('https://arkanium.consulting/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://arkanium.consulting', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const families = groupServices(await readCollection(DEFAULT_CONTENT_ROOT, 'services', 'es')).map((f) => f.value);
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Validación
test('las prioridades permitidas son las familias del catálogo más «unsure»', () => {
  assert.deepEqual([...PRIORITY_VALUES].sort(), [...families, 'unsure'].sort());
});
test('envío válido se acepta', () => {
  const r = parseLead(valid, NOW);
  assert.equal(r.kind, 'ok');
  assert.equal(r.lead.receivedAt, NOW.toISOString());
});
test('sin consentimiento se rechaza en el campo consent', () => {
  assert.deepEqual(parseLead({ ...valid, consent: false }, NOW), { kind: 'invalid', field: 'consent' });
});
test('correo inválido se rechaza', () => {
  assert.deepEqual(parseLead({ ...valid, email: 'no-es-correo' }, NOW), { kind: 'invalid', field: 'email' });
});
test('prioridad fuera de la lista se rechaza', () => {
  assert.deepEqual(parseLead({ ...valid, priority: 'cto' }, NOW), { kind: 'invalid', field: 'priority' });
});
test('contexto demasiado largo se rechaza', () => {
  assert.deepEqual(parseLead({ ...valid, context: 'x'.repeat(2001) }, NOW), { kind: 'invalid', field: 'context' });
});
test('idioma no soportado se rechaza', () => {
  assert.deepEqual(parseLead({ ...valid, locale: 'de' }, NOW), { kind: 'invalid', field: 'locale' });
});
test('campo trampa lleno: se descarta sin error visible', () => {
  assert.deepEqual(parseLead({ ...valid, website: 'http://spam.test' }, NOW), { kind: 'spam' });
});
test('servicio con formato inválido se descarta sin rechazar al lead', () => {
  const r = parseLead({ ...valid, service: '../../etc' }, NOW);
  assert.equal(r.kind, 'ok');
  assert.equal(r.lead.service, undefined);
});
test('servicio válido se conserva', () => {
  assert.equal(parseLead({ ...valid, service: 'technical-health-check' }, NOW).lead.service, 'technical-health-check');
});

// Composición
test('correo: asunto con prioridad y nombre, y contexto completo en texto plano', () => {
  const { subject, text } = leadEmail(parseLead(valid, NOW).lead);
  assert.equal(subject, '[Lead] Estrategia — Ana Pérez');
  assert.match(text, /Correo: ana@empresa\.com/);
  assert.match(text, /Contexto:\nNecesitamos ordenar/);
});
test('alerta de Slack: datos mínimos y contexto recortado a 200 caracteres', () => {
  const msg = slackAlert(parseLead({ ...valid, context: 'y'.repeat(500) }, NOW).lead);
  assert.match(msg, /Nuevo lead \(es\): Ana Pérez — Estrategia/);
  assert.ok(msg.split('Contexto: ')[1].length <= 202);
});

// Endpoint: el lead se guarda en la API antes de cualquier aviso. El sitio no envía correo ni Slack.
const PLATFORM_ENV = { ARKANIUM_API_URL: 'https://api.arkanium.test', LEAD_INTAKE_TOKEN: 'token-de-prueba' };

test('origen distinto → 403 sin guardar nada', async () => {
  const calls = fakeFetch();
  const res = await onRequestPost({ request: request(valid, { origin: 'https://otro.test' }), env: PLATFORM_ENV });
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});
test('cuerpo que no es JSON → 415 o 400 sin guardar nada', async () => {
  const calls = fakeFetch();
  const r1 = await onRequestPost({ request: request('{}', { 'content-type': 'text/plain' }), env: PLATFORM_ENV });
  const r2 = await onRequestPost({ request: request('{roto'), env: PLATFORM_ENV });
  assert.equal(r1.status, 415);
  assert.equal(r2.status, 400);
  assert.equal(calls.length, 0);
});
test('cuerpo de más de 16 KB → 413', async () => {
  const res = await onRequestPost({ request: request({ ...valid, context: 'x'.repeat(20000) }), env: PLATFORM_ENV });
  assert.equal(res.status, 413);
});
test('datos inválidos → 400 con el campo, sin guardar nada', async () => {
  const calls = fakeFetch();
  const res = await onRequestPost({ request: request({ ...valid, email: 'mal' }), env: PLATFORM_ENV });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, 'email');
  assert.equal(calls.length, 0);
});
test('sin API configurada → 503, nunca éxito', async () => {
  const calls = fakeFetch();
  const res = await onRequestPost({ request: request(valid), env: {} });
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});
test('campo trampa → 200 sin guardar nada', async () => {
  const calls = fakeFetch();
  const res = await onRequestPost({ request: request({ ...valid, website: 'bot' }), env: PLATFORM_ENV });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});
test('envío correcto: se guarda en /leads con el token del servidor y el consentimiento, y nada más sale', async () => {
  const calls = fakeFetch();
  const res = await onRequestPost({ request: request({ ...valid, service: 'technical-health-check' }), env: PLATFORM_ENV });
  assert.equal(res.status, 200);
  // Solo una llamada: a la API. Ni correo ni Slack desde el sitio; los avisos los hace n8n.
  assert.equal(calls.length, 1);
  const [platform] = calls;
  assert.equal(platform.url, 'https://api.arkanium.test/leads');
  assert.equal(platform.headers.authorization, 'Bearer token-de-prueba');
  assert.equal(platform.body.source, 'website');
  assert.equal(platform.body.email, 'ana@empresa.com');
  assert.deepEqual(platform.body.consent, { accepted: true, textVersion: CONSENT_TEXT_VERSION });
  assert.match(platform.body.context, /Servicio: technical-health-check/);
});
test('la API no responde → 503 not_saved: el visitante ve un error y puede reintentar', async () => {
  const calls = fakeFetch({ platform: 'network' });
  const res = await onRequestPost({ request: request(valid), env: PLATFORM_ENV });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_saved');
  assert.equal(calls.length, 1);
});
test('la API rechaza el lead (401) → 503 not_saved, nunca éxito falso', async () => {
  fakeFetch({ platform: 401 });
  const res = await onRequestPost({ request: request(valid), env: PLATFORM_ENV });
  assert.equal(res.status, 503);
});
test('el contexto que llega a la API nunca supera 2000 caracteres', () => {
  const payload = platformPayload({ name: 'Ana', email: 'a@b.co', priority: 'strategy', context: 'x'.repeat(2000), locale: 'es', receivedAt: '2026-10-14T12:00:00Z', service: 'technical-health-check' });
  assert.ok(payload.context.length <= 2000);
});

try {
  let passed = 0;
  for (const t of tests) {
    await t.fn();
    passed++;
    console.log('  ✓', t.name);
  }
  console.log(`\n${passed} pruebas OK`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
