/**
 * Pruebas del contenido local GraphQL (graphql-js + archivos JSON por idioma). Sin dependencias.
 *   npm run test:content
 * Usa una carpeta temporal: nunca lee ni escribe en content/.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runContentQuery } from '../src/lib/content/execute.ts';
import { normalizeArticle, normalizeSummaries } from '../src/lib/insights/normalize.ts';
import { ARTICLE_DETAIL_QUERY, ARTICLE_SUMMARIES_QUERY } from '../src/lib/insights/queries.ts';

const NOW = Date.parse('2026-10-14T00:00:00Z');
const rt = { children: [{ type: 'paragraph', children: [{ text: 'Cuerpo en español' }] }] };
const base = {
  slug: 'primer-analisis',
  title: 'Primer análisis',
  excerpt: 'Resumen breve',
  featured: false,
  publishedAt: '2026-03-01T00:00:00Z',
  editorialStatus: 'READY',
  content: { raw: rt },
  seo: { metaTitle: 'SEO', metaDescription: 'Descripción', noIndex: false },
};

const root = await mkdtemp(path.join(os.tmpdir(), 'ark-content-'));
const write = async (locale, name, data) => {
  const dir = path.join(root, 'insights', locale);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
};

// Datos de prueba: un publicado, uno programado, uno solo en inglés, uno ignorado (empieza por _).
await write('es', 'a1.json', { ...base, id: 'a1', featuredImage: { url: 'https://example.com/c.jpg', width: 1200, height: 630, altText: 'Portada', caption: null } });
await write('es', 'a2.json', { ...base, id: 'a2', slug: 'futuro', publishedAt: '2999-01-01T00:00:00Z' });
await write('en', 'b1.json', { ...base, id: 'b1', slug: 'english-only', title: 'English only', excerpt: 'Summary' });
await write('es', '_borrador.json', { ...base, id: 'x', slug: 'ignorado' });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const summaries = async (locale) => {
  const raw = await runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale }, root);
  return normalizeSummaries(raw, NOW);
};

test('listado en español: solo el artículo publicado en ese idioma', async () => {
  const items = await summaries('es');
  assert.deepEqual(items.map((a) => a.slug), ['primer-analisis']);
});

test('aislamiento por idioma: el artículo solo en inglés no aparece en español', async () => {
  const items = await summaries('es');
  assert.equal(items.some((a) => a.slug === 'english-only'), false);
});

test('listado en inglés incluye solo lo que existe en inglés', async () => {
  const items = await summaries('en');
  assert.deepEqual(items.map((a) => a.slug), ['english-only']);
});

test('idioma sin carpeta devuelve lista vacía (no error)', async () => {
  const raw = await runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'pt' }, root);
  assert.equal(raw.articles.length, 0);
});

test('archivos que empiezan por _ se ignoran', async () => {
  const items = await summaries('es');
  assert.equal(items.some((a) => a.slug === 'ignorado'), false);
});

test('imagen de portada llega con alt y dimensiones', async () => {
  const [item] = await summaries('es');
  assert.equal(item.featuredImage.alt, 'Portada');
  assert.equal(item.featuredImage.width, 1200);
});

test('detalle: devuelve contenido y SEO del idioma pedido', async () => {
  const raw = await runContentQuery(ARTICLE_DETAIL_QUERY, { locale: 'es', slug: 'primer-analisis' }, root);
  const article = normalizeArticle(raw.article, NOW);
  assert.ok(article);
  assert.equal(article.title, 'Primer análisis');
  assert.equal(article.seo.title, 'SEO');
  assert.equal(article.content.length > 0, true);
});

test('detalle: slug que solo existe en otro idioma → no existe (sin fallback)', async () => {
  const raw = await runContentQuery(ARTICLE_DETAIL_QUERY, { locale: 'es', slug: 'english-only' }, root);
  assert.equal(raw.article, null);
  assert.equal(normalizeArticle(raw.article, NOW), undefined);
});

test('idioma no soportado se rechaza por validación del esquema', async () => {
  await assert.rejects(() => runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'de' }, root), /Locale/);
});

test('campo inexistente en la consulta se rechaza', async () => {
  await assert.rejects(() => runContentQuery('{ articles(locale: es) { noExiste } }', {}, root), /noExiste/);
});

test('JSON malformado: error que nombra el archivo', async () => {
  await write('fr', 'roto.json', '{ esto no es json');
  await assert.rejects(() => runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'fr' }, root), /fr\/roto\.json: JSON no válido/);
});

test('JSON que no es objeto: error que nombra el archivo', async () => {
  await write('fr', 'lista.json', '[1, 2]');
  await assert.rejects(() => runContentQuery(ARTICLE_SUMMARIES_QUERY, { locale: 'fr' }, root), /fr\/lista\.json: se esperaba un objeto JSON/);
});

let passed = 0;
try {
  console.log('Contenido local GraphQL');
  for (const t of tests) {
    await t.fn();
    passed++;
    console.log('  ✓', t.name);
  }
  console.log(`\n${passed} pruebas OK`);
} finally {
  await rm(root, { recursive: true, force: true });
}
