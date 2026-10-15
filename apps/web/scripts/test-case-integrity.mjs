/**
 * Pruebas de las reglas de integridad editorial de Case Studies (sin dependencias).
 *   npm run test:integrity
 */
import assert from 'node:assert/strict';
import { normalizeCaseStudies } from '../src/lib/case-studies/normalize.ts';

const base = { slug: 'case', status: 'PUBLISHED', visibility: 'PUBLIC', title: 'T', challengeSummary: 'C', outcomes: ['O'] };
const rep = { ...base, type: 'REPRESENTATIVE', evidenceStatus: 'NOT_REQUIRED' };
const real = { ...base, type: 'REAL', engagementReference: 'ENG-1', evidenceStatus: 'VERIFIED', publicationAuthorization: { status: 'APPROVED' }, clientVisibility: 'PUBLIC', clientName: 'Acme' };
const anon = { ...real, type: 'ANONYMIZED', clientVisibility: 'HIDDEN', clientName: null, clientDescriptor: 'B2B financial services company' };
const run = (...items) => normalizeCaseStudies({ caseStudies: items });
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('  ✓', name); };
const rejects = (name, item, pattern) => ok(name, () => assert.throws(() => run(item), pattern));

console.log('Casos válidos');
ok('REPRESENTATIVE sin cliente se publica', () => assert.equal(run(rep)[0].client, undefined));
ok('REAL verificado + autorizado + cliente público se publica', () => assert.equal(run(real)[0].client.name, 'Acme'));
ok('ANONYMIZED verificado + autorizado se publica sin cliente', () => { const c = run(anon)[0]; assert.equal(c.client, undefined); assert.equal(c.clientDescriptor, 'B2B financial services company'); });

console.log('Un caso engañoso NO llega a publicarse (el build falla)');
rejects('REPRESENTATIVE con clientName', { ...rep, clientName: 'Acme' }, /no puede tener cliente/);
rejects('REPRESENTATIVE con clientWebsite', { ...rep, clientWebsite: 'https://acme.com' }, /no puede tener cliente/);
rejects('REPRESENTATIVE con engagementReference', { ...rep, engagementReference: 'ENG-9' }, /engagement real/);
rejects('REPRESENTATIVE con evidencia VERIFIED', { ...rep, evidenceStatus: 'VERIFIED' }, /NOT_REQUIRED/);
rejects('REPRESENTATIVE con métrica verificada', { ...rep, metrics: [{ label: 'x', value: '38', unit: '%', verified: true }] }, /métricas verificadas/);
rejects('REAL PUBLISHED con evidencia PENDING', { ...real, evidenceStatus: 'PENDING' }, /VERIFIED/);
rejects('REAL PUBLISHED sin autorización aprobada', { ...real, publicationAuthorization: { status: 'PENDING' } }, /APPROVED/);
rejects('REAL PUBLISHED sin autorización', { ...real, publicationAuthorization: null }, /APPROVED/);
rejects('REAL PUBLISHED sin engagementReference', { ...real, engagementReference: null }, /engagementReference/);
rejects('REAL público sin clientName', { ...real, clientName: null }, /clientName/);
rejects('ANONYMIZED que identifica al cliente', { ...anon, clientName: 'Acme' }, /no puede identificar/);
rejects('ANONYMIZED con clientVisibility PUBLIC', { ...anon, clientVisibility: 'PUBLIC' }, /no puede identificar/);
rejects('ANONYMIZED sin autorización', { ...anon, publicationAuthorization: { status: 'PENDING' } }, /APPROVED/);
rejects('type inválido', { ...rep, type: 'CLIENT' }, /type inválido/);
rejects('sin summary ni challengeSummary', { ...rep, challengeSummary: null }, /summary/);
rejects('slug inválido', { ...rep, slug: 'Bad Slug/../x' }, /Slug inválido/);

console.log('Publicación y visibilidad');
ok('DRAFT no se renderiza (ni se valida)', () => assert.equal(run({ ...real, status: 'DRAFT', evidenceStatus: 'PENDING' }).length, 0));
ok('REVIEW no se renderiza', () => assert.equal(run({ ...rep, status: 'REVIEW' }).length, 0));
ok('ARCHIVED no se renderiza', () => assert.equal(run({ ...rep, status: 'ARCHIVED' }).length, 0));
ok('PRIVATE no se renderiza', () => assert.equal(run({ ...rep, visibility: 'PRIVATE' }).length, 0));
ok('UNLISTED se renderiza pero es noindex', () => { const c = run({ ...rep, visibility: 'UNLISTED' })[0]; assert.equal(c.seo.noIndex, true); });
ok('slugs duplicados fallan', () => assert.throws(() => run(rep, rep), /duplicado/));

console.log('Métricas y datos del cliente');
ok('métrica no verificada de un REAL se descarta', () => {
  const c = run({ ...real, metrics: [{ label: 'a', value: '1', verified: false }, { label: 'b', value: '38', unit: '%', verified: true, source: 'Informe' }] })[0];
  assert.deepEqual(c.metrics.map((m) => m.label), ['b']);
});
ok('REPRESENTATIVE descarta métricas no verificadas (nunca se muestran)', () => assert.equal(run({ ...rep, metrics: [{ label: 'a', value: '1', verified: false }] })[0].metrics.length, 0));
ok('REAL con clientVisibility HIDDEN no expone el cliente', () => assert.equal(run({ ...real, clientVisibility: 'HIDDEN' })[0].client, undefined));
ok('URL con esquema javascript: se descarta', () => assert.equal(run({ ...real, clientWebsite: 'javascript:alert(1)' })[0].client.website, undefined));
ok('clientDescriptor solo se conserva en ANONYMIZED', () => assert.equal(run({ ...rep, clientDescriptor: 'x' })[0].clientDescriptor, undefined));

console.log('Orden y relaciones');
ok('featured primero, luego publishedAt descendente', () => {
  const r = run({ ...rep, slug: 'a', publishedAt: '2026-01-01' }, { ...rep, slug: 'b', publishedAt: '2026-06-01' }, { ...rep, slug: 'c', featured: true, publishedAt: '2025-01-01' });
  assert.deepEqual(r.map((c) => c.slug), ['c', 'b', 'a']);
});
ok('sin fecha se conserva el orden del origen', () => assert.deepEqual(run({ ...rep, slug: 'x' }, { ...rep, slug: 'y' }).map((c) => c.slug), ['x', 'y']));
ok('relatedCaseStudies ignora borradores, privados y a sí mismo', () => {
  const r = run({ ...rep, slug: 'a', relatedCaseStudies: [{ slug: 'a' }, { slug: 'b' }, { slug: 'draft' }] }, { ...rep, slug: 'b' }, { ...rep, slug: 'draft', status: 'DRAFT' });
  assert.deepEqual(r.find((c) => c.slug === 'a').relatedCaseStudies, ['b']);
});

console.log(`\n${passed} pruebas OK`);
