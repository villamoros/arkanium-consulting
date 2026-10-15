/**
 * Pruebas del blog: destacado, paginación, índice de contenido y resolución de autores (contrato ARK-BLOG-004).
 *   npm run test:blog
 * Usa una carpeta temporal: nunca lee ni escribe en content/.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runContentQuery } from '../src/lib/content/execute.ts';
import { withAuthors } from '../src/lib/content/authors.ts';
import { normalizeSummaries, normalizeArticle } from '../src/lib/insights/normalize.ts';
import { ARTICLE_DETAIL_QUERY, ARTICLE_SUMMARIES_QUERY } from '../src/lib/insights/queries.ts';
import { sanitizeRichText } from '../src/lib/insights/richtext.ts';
import { PAGE_SIZE, pageCount, pageOf, splitListing, showToc, tableOfContents, withHeadingIds } from '../src/lib/insights/listing.ts';

const NOW = Date.parse('2026-10-14T00:00:00Z');
const base = { format: 'analysis', category: { slug: 'strategy-business', name: 'Estrategia' }, excerpt: 'E', title: 'T', editorialStatus: 'READY', content: { raw: { children: [{ type: 'paragraph', children: [{ text: 'cuerpo' }] }] } } };
const at = (slug, date, extra = {}) => ({ ...base, id: `id-${slug}`, slug, publishedAt: date, ...extra });
const h2 = (text) => ({ type: 'heading-one', children: [{ text }] });
const p = (text) => ({ type: 'paragraph', children: [{ text }] });
// El índice trabaja sobre el árbol saneado (el mismo que llega a las páginas).
const clean = (children) => sanitizeRichText({ children }, 'test');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const summaries = (items) => normalizeSummaries({ articles: items }, NOW);

test('el destacado es el más reciente marcado y no se repite en la cuadrícula', () => {
  const all = summaries([
    at('viejo-destacado', '2025-01-01T00:00:00Z', { featured: true }),
    at('reciente', '2026-06-01T00:00:00Z'),
    at('nuevo-destacado', '2026-03-01T00:00:00Z', { featured: true }),
  ]);
  const l = splitListing(all);
  assert.equal(l.highlight.slug, 'nuevo-destacado');
  assert.deepEqual(l.items.map((a) => a.slug), ['reciente', 'viejo-destacado']);
});

test('sin destacados: la cuadrícula contiene todo y no hay highlight', () => {
  const l = splitListing(summaries([at('a', '2026-01-01T00:00:00Z'), at('b', '2026-02-01T00:00:00Z')]));
  assert.equal(l.highlight, undefined);
  assert.equal(l.items.length, 2);
});

test('paginación: 25 artículos → 3 páginas de 12, 12 y 1', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal(PAGE_SIZE, 12);
  assert.equal(pageCount(items.length), 3);
  assert.equal(pageOf(items, 1).length, 12);
  assert.equal(pageOf(items, 2)[0], 13);
  assert.deepEqual(pageOf(items, 3), [25]);
});

test('sin artículos: una página vacía (no 0 páginas)', () => {
  assert.equal(pageCount(0), 1);
  assert.deepEqual(pageOf([], 1), []);
});

test('índice: solo encabezados H2 de nivel superior, con id estable', () => {
  const nodes = clean([h2('Diagnóstico'), p('texto'), h2('Plan de acción'), { type: 'heading-two', children: [{ text: 'sub' }] }]);
  const toc = tableOfContents(nodes);
  assert.deepEqual(toc, [{ id: 'sec-1', text: 'Diagnóstico' }, { id: 'sec-2', text: 'Plan de acción' }]);
  assert.equal(withHeadingIds(nodes)[0].id, 'sec-1');
});

test('índice: se muestra solo con dos secciones o más', () => {
  assert.equal(showToc(tableOfContents(clean([h2('Uno'), p('x')]))), false);
  assert.equal(showToc(tableOfContents(clean([h2('Uno'), h2('Dos')]))), true);
});

test('autor: se resuelve desde su archivo; si no existe, byline = null', () => {
  const authors = new Map([['ana', { id: 'ana', name: 'Ana Pérez', role: 'Arquitecta' }]]);
  const warn = console.warn;
  let warned = 0;
  console.warn = () => { warned++; };
  try {
    const out = withAuthors([{ slug: 'x', author: 'ana' }, { slug: 'y', author: 'nadie' }, { slug: 'z' }], authors, 'es');
    assert.equal(out[0].author.name, 'Ana Pérez');
    assert.equal(out[1].author, null);
    assert.equal(out[2].author, undefined);
    assert.equal(warned, 1);
  } finally {
    console.warn = warn;
  }
});

test('GraphQL: el detalle entrega formato, categoría, portada y autor resuelto', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ark-blog-'));
  try {
    await mkdir(path.join(root, 'insights', 'es'), { recursive: true });
    await mkdir(path.join(root, 'authors', 'es'), { recursive: true });
    await writeFile(path.join(root, 'authors', 'es', 'ana.json'), JSON.stringify({ id: 'ana', name: 'Ana Pérez', slug: 'ana-perez', role: 'Arquitecta', bio: 'Bio' }));
    await writeFile(path.join(root, 'insights', 'es', 'a1.json'), JSON.stringify({
      ...at('primer', '2026-03-01T00:00:00Z', { author: 'ana', coverAlt: 'Portada', featuredImage: { url: 'https://x.test/c.jpg', width: 10, height: 5 } }),
      content: { raw: { children: [h2('Uno'), p('dos')] } },
    }));
    const detail = await runContentQuery(ARTICLE_DETAIL_QUERY, { locale: 'es', slug: 'primer' }, root);
    const article = normalizeArticle(detail.article, NOW);
    assert.equal(article.format, 'analysis');
    assert.equal(article.category.name, 'Estrategia');
    assert.equal(article.featuredImage.alt, 'Portada');
    assert.equal(article.authorDetail.name, 'Ana Pérez');
    assert.equal(article.authorDetail.role, 'Arquitecta');
    assert.equal(tableOfContents(article.content).length, 1);

    const list = await runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'es' }, root);
    assert.equal(summaries(list.articles)[0].author.name, 'Ana Pérez');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('GraphQL: artículo sin autor: byline ausente, sin error', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ark-blog-'));
  try {
    await mkdir(path.join(root, 'insights', 'fr'), { recursive: true });
    await writeFile(path.join(root, 'insights', 'fr', 'b.json'), JSON.stringify(at('sin-autor', '2026-03-01T00:00:00Z')));
    const list = await runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'fr' }, root);
    assert.equal(summaries(list.articles)[0].author, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

let passed = 0;
try {
  console.log('Blog: listado, paginación, índice y autores');
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
