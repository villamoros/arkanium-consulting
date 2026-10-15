/**
 * Pruebas de Insights: reglas de publicación + saneado de Rich Text (sin dependencias).
 *   npm run test:insights
 */
import assert from 'node:assert/strict';
import { normalizeArticle, normalizeSummaries, publicationOf } from '../src/lib/insights/normalize.ts';
import { plainText, readingMinutes, sanitizeRichText } from '../src/lib/insights/richtext.ts';

const NOW = Date.parse('2026-10-07T00:00:00Z');
const rt = { children: [{ type: 'paragraph', children: [{ text: 'Hola mundo' }] }] };
const art = { id: 'a1', slug: 'hello', title: 'T', excerpt: 'E', publishedAt: '2026-03-01T00:00:00Z', editorialStatus: 'READY', content: { raw: rt }, format: 'analysis', category: { slug: 'strategy-business', name: 'Estrategia' } };
const sums = (...items) => normalizeSummaries({ articles: items }, NOW);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓', name); };

console.log('Reglas de publicación');
ok('artículo publicado, localizado y con fecha pasada → público', () => assert.equal(sums(art).length, 1));
ok('sin título en este idioma → no existe en ese idioma (sin fallback)', () => assert.equal(sums({ ...art, title: null }).length, 0));
ok('sin slug en este idioma → no existe', () => assert.equal(sums({ ...art, slug: null }).length, 0));
ok('sin excerpt en este idioma → no existe', () => assert.equal(sums({ ...art, excerpt: '' }).length, 0));
ok('publishedAt futuro → no público', () => assert.equal(sums({ ...art, publishedAt: '2999-01-01T00:00:00Z' }).length, 0));
ok('scheduledAt futuro → no público', () => assert.equal(sums({ ...art, scheduledAt: '2999-01-01T00:00:00Z' }).length, 0));
ok('scheduledAt pasado → público', () => assert.equal(sums({ ...art, scheduledAt: '2026-01-01T00:00:00Z' }).length, 1));
ok('sin publishedAt → no público (no se inventan fechas)', () => assert.equal(sums({ ...art, publishedAt: null }).length, 0));
for (const s of ['IDEA', 'WRITING', 'REVIEW', 'ARCHIVED']) ok(`editorialStatus ${s} → no público`, () => assert.equal(sums({ ...art, editorialStatus: s }).length, 0));
ok('editorialStatus sin definir → público', () => assert.equal(sums({ ...art, editorialStatus: null }).length, 1));
ok('publicationOf es pura y explica el motivo', () => assert.equal(publicationOf({ ...art, publishedAt: '2999-01-01' }, NOW), 'scheduled'));
ok('updatedAt no sustituye a publishedAt', () => assert.equal(sums({ ...art, publishedAt: null, updatedAt: '2026-03-01T00:00:00Z' }).length, 0));
ok('slug inválido rompe el build', () => assert.throws(() => sums({ ...art, slug: 'Bad Slug/../x' }), /Slug inválido/));
ok('slug duplicado en el mismo idioma rompe el build', () => assert.throws(() => sums(art, { ...art, id: 'a2' }), /duplicado/));
ok('mismo slug en idiomas distintos es válido (cada idioma es su propio conjunto)', () => { assert.equal(sums(art).length, 1); assert.equal(sums({ ...art, id: 'b' }).length, 1); });

console.log('Orden y detalle');
ok('orden por fecha descendente; el destacado NO altera el orden', () => {
  const r = sums({ ...art, id: '1', slug: 'a', publishedAt: '2026-01-01' }, { ...art, id: '2', slug: 'b', publishedAt: '2026-06-01' }, { ...art, id: '3', slug: 'c', featured: true, publishedAt: '2025-01-01' });
  assert.deepEqual(r.map((a) => a.slug), ['b', 'a', 'c']);
});
ok('detalle: no público → undefined', () => assert.equal(normalizeArticle({ ...art, editorialStatus: 'REVIEW' }, NOW), undefined));
ok('detalle: localizado sin contenido rompe el build', () => assert.throws(() => normalizeArticle({ ...art, content: { raw: { children: [] } } }, NOW), /sin contenido/));
ok('detalle: Rich Text corrupto rompe el build', () => assert.throws(() => normalizeArticle({ ...art, content: { raw: 'no-json' } }, NOW), /Rich Text inválido/));
ok('canonicalUrl es opcional; si no es https se descarta', () => {
  assert.equal(normalizeArticle(art, NOW).seo.canonical, undefined);
  assert.equal(normalizeArticle({ ...art, seo: { canonicalUrl: 'javascript:alert(1)' } }, NOW).seo.canonical, undefined);
  assert.equal(normalizeArticle({ ...art, seo: { canonicalUrl: 'https://example.com/x' } }, NOW).seo.canonical, 'https://example.com/x');
});
ok('autor: avatar/linkedin solo https', () => assert.equal(normalizeArticle({ ...art, author: { name: 'A', linkedin: 'http://x', website: 'https://ok.com' } }, NOW).authorDetail.linkedin, undefined));
ok('imagen destacada solo https; el alt viene de coverAlt', () => {
  assert.equal(normalizeArticle({ ...art, featuredImage: { url: 'http://x/i.png' }, coverAlt: 'Portada' }, NOW).featuredImage, undefined);
  assert.equal(normalizeArticle({ ...art, featuredImage: { url: 'https://x/i.png' }, coverAlt: 'Portada' }, NOW).featuredImage.alt, 'Portada');
});
ok('portada sin coverAlt rompe el build (texto alternativo obligatorio)', () => assert.throws(() => normalizeArticle({ ...art, featuredImage: { url: 'https://x/i.png' } }, NOW), /coverAlt/));

console.log('Reglas editoriales v2');
ok('artículo publicado sin formato rompe el build', () => assert.throws(() => sums({ ...art, format: undefined }), /formato/));
ok('formato fuera de analysis/guide rompe el build', () => assert.throws(() => sums({ ...art, format: 'opinion' }), /formato/));
ok('artículo publicado sin categoría rompe el build', () => assert.throws(() => sums({ ...art, category: undefined }), /categoría/));
ok('una categoría se expone también como lista (para las tarjetas)', () => assert.equal(sums(art)[0].category.name, 'Estrategia'));
ok('no publicable sin formato se omite sin error (no es un error editorial)', () => assert.equal(sums({ ...art, format: undefined, editorialStatus: 'REVIEW' }).length, 0));
ok('dos destacados en un idioma: se permite (avisa), ambos conservan su fecha', () => {
  const r = sums({ ...art, id: '1', slug: 'a', featured: true }, { ...art, id: '2', slug: 'b', featured: true, publishedAt: '2026-05-01T00:00:00Z' });
  assert.equal(r.length, 2);
});

console.log('Rich Text: seguridad por construcción');
const clean = (children) => sanitizeRichText({ children }, 't');
ok('texto con <script> se conserva como TEXTO (Astro lo escapa), nunca como nodo', () => {
  const r = clean([{ type: 'paragraph', children: [{ text: '<script>alert(1)</script>' }] }]);
  assert.equal(r[0].children[0].kind, 'text');
  assert.equal(r[0].children[0].text, '<script>alert(1)</script>');
});
ok('enlace javascript: se elimina, se conserva el texto', () => {
  const r = clean([{ type: 'paragraph', children: [{ type: 'link', href: 'javascript:alert(1)', children: [{ text: 'clic' }] }] }]);
  assert.equal(r[0].children[0].kind, 'text');
});
ok('enlace data: y vbscript: se eliminan', () => {
  for (const href of ['data:text/html,<b>x</b>', 'vbscript:x', '//evil.com/x']) assert.equal(clean([{ type: 'paragraph', children: [{ type: 'link', href, children: [{ text: 'x' }] }] }])[0].children[0].kind, 'text', href);
});
ok('enlaces https, relativos y mailto se conservan', () => {
  for (const href of ['https://a.com/x', '/en/solutions/', '#sec', 'mailto:a@b.com']) assert.equal(clean([{ type: 'paragraph', children: [{ type: 'link', href, children: [{ text: 'x' }] }] }])[0].children[0].kind, 'link', href);
});
ok('enlace externo marca external; relativo no', () => {
  const [a, b] = ['https://a.com', '/x'].map((href) => clean([{ type: 'paragraph', children: [{ type: 'link', href, children: [{ text: 'x' }] }] }])[0].children[0]);
  assert.equal(a.external, true); assert.equal(b.external, false);
});
ok('nodos desconocidos (iframe/video/embed) se desenvuelven: sin etiqueta, solo texto', () => {
  const r = clean([{ type: 'iframe', src: 'https://evil', children: [{ text: 'solo texto' }] }]);
  assert.deepEqual(r, [{ kind: 'text', text: 'solo texto', marks: {} }]);
});
ok('imagen con http: o sin src se descarta; https se conserva', () => {
  assert.equal(clean([{ type: 'image', src: 'http://x/i.png' }]).length, 0);
  assert.equal(clean([{ type: 'image', src: 'javascript:1' }]).length, 0);
  assert.equal(clean([{ type: 'image', src: 'https://x/i.png', altText: 'alt', width: 10, height: 5 }])[0].alt, 'alt');
});
ok('los h1 del contenido bajan a h2 (la página ya tiene su h1)', () => assert.equal(clean([{ type: 'heading-one', children: [{ text: 'x' }] }])[0].tag, 'h2'));
ok('listas: list-item-child se desenvuelve', () => {
  const r = clean([{ type: 'bulleted-list', children: [{ type: 'list-item', children: [{ type: 'list-item-child', children: [{ text: 'uno' }] }] }] }]);
  assert.equal(r[0].tag, 'ul'); assert.equal(r[0].children[0].tag, 'li'); assert.equal(r[0].children[0].children[0].text, 'uno');
});
ok('marcas (negrita/cursiva/código) se conservan; claves arbitrarias no', () => {
  const r = clean([{ type: 'paragraph', children: [{ text: 'x', bold: true, onclick: 'evil()', style: 'x' }] }])[0].children[0];
  assert.deepEqual(r.marks, { bold: true });
  assert.deepEqual(Object.keys(r).sort(), ['kind', 'marks', 'text']);
});
ok('profundidad excesiva se corta (sin recursión infinita)', () => {
  let node = { text: 'deep' }; for (let i = 0; i < 50; i++) node = { type: 'block-quote', children: [node] };
  assert.doesNotThrow(() => clean([node]));
});
ok('tiempo de lectura derivado (200 ppm, mínimo 1)', () => {
  assert.equal(readingMinutes(clean([{ type: 'paragraph', children: [{ text: 'a b c' }] }])), 1);
  assert.equal(readingMinutes(clean([{ type: 'paragraph', children: [{ text: Array(401).fill('w').join(' ') }] }])), 2);
  assert.equal(plainText(clean([{ type: 'paragraph', children: [{ text: 'uno' }, { text: 'dos' }] }])).trim(), 'uno dos');
});

console.log(`\n${n} pruebas OK`);
