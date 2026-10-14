/**
 * Pruebas del catálogo de servicios sobre el contenido REAL (content/services/<idioma>/*.json).
 *   npm run test:services
 * Comprueba que los 42 servicios existen en los cuatro idiomas con los mismos valores y campos completos,
 * que la agrupación familia → categoría → servicio es la declarada, y que la consulta GraphQL llega a normalize.ts.
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONTENT_ROOT, runContentQuery } from '../src/lib/content/execute.ts';
import { readCollection } from '../src/lib/content/store.ts';
import { groupServices } from '../src/lib/content/services.ts';
import { normalizeCatalog } from '../src/lib/catalog/normalize.ts';
import { CATALOG_QUERY } from '../src/lib/catalog/queries.ts';

const LOCALES = ['en', 'es', 'pt', 'fr'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXPECTED_CATEGORIES = {
  strategy: ['technology-diagnosis', 'digital-strategy', 'technology-strategy', 'it-roadmapping'],
  product: ['product-discovery', 'product-definition', 'mvp-strategy', 'product-management'],
  architecture: ['architecture-consulting', 'technology-governance', 'technology-leadership'],
};
const EXPECTED_FAMILY_NAMES = {
  en: ['Strategy', 'Product', 'Architecture'],
  es: ['Estrategia', 'Producto', 'Arquitectura'],
  pt: ['Estratégia', 'Produto', 'Arquitetura'],
  fr: ['Stratégie', 'Produit', 'Architecture'],
};

const records = Object.fromEntries(await Promise.all(LOCALES.map(async (l) => [l, await readCollection(DEFAULT_CONTENT_ROOT, 'services', l)])));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('42 servicios por idioma', () => {
  for (const l of LOCALES) assert.equal(records[l].length, 42, `${l}: ${records[l].length}`);
});

test('mismos valores (slugs) en los cuatro idiomas', () => {
  const sets = LOCALES.map((l) => records[l].map((r) => r.value).sort().join('|'));
  assert.ok(sets.every((s) => s === sets[0]));
});

test('slugs válidos y sin duplicados', () => {
  const values = records.en.map((r) => r.value);
  assert.equal(new Set(values).size, values.length);
  for (const v of values) assert.match(v, SLUG, v);
});

test('campos obligatorios completos en todos los idiomas', () => {
  for (const l of LOCALES) {
    for (const r of records[l]) {
      for (const f of ['label', 'name', 'description', 'problem', 'solution']) {
        assert.ok(typeof r[f] === 'string' && r[f].trim(), `${l}/${r.value}: falta ${f}`);
      }
      assert.ok(Array.isArray(r.outcomes) && r.outcomes.length > 0, `${l}/${r.value}: sin resultados`);
      assert.ok(r.outcomes.every((o) => typeof o === 'string' && o.trim()), `${l}/${r.value}: resultado vacío`);
    }
  }
});

test('duración sin definir (null): ningún servicio promete plazos todavía', () => {
  for (const l of LOCALES) for (const r of records[l]) assert.equal(r.duration, null, `${l}/${r.value}`);
});

test('familias en orden Strategy, Product, Architecture (nombres localizados)', () => {
  for (const l of LOCALES) {
    const groups = groupServices(records[l]);
    assert.deepEqual(groups.map((g) => g.name), EXPECTED_FAMILY_NAMES[l], l);
  }
});

test('categorías y servicios agrupados según lo declarado', () => {
  const groups = groupServices(records.en);
  for (const g of groups) {
    assert.deepEqual(g.categories.map((c) => c.value), EXPECTED_CATEGORIES[g.value], g.value);
  }
  assert.equal(groups.reduce((n, g) => n + g.categories.reduce((m, c) => m + c.services.length, 0), 0), 42);
});

test('la consulta GraphQL del catálogo llega a normalizeCatalog con 3 familias y 42 servicios', async () => {
  const raw = await runContentQuery(CATALOG_QUERY, { locale: 'es' });
  const catalog = normalizeCatalog(raw);
  assert.equal(catalog.families.length, 3);
  assert.equal(catalog.families.flatMap((f) => f.categories.flatMap((c) => c.services)).length, 42);
  const hhc = catalog.families.find((f) => f.slug === 'strategy').categories[0].services[0];
  assert.equal(hhc.slug, 'technical-health-check');
  assert.equal(hhc.label, 'Chequeo técnico');
  assert.equal(hhc.duration, undefined);
  assert.ok(hhc.approach && hhc.problem && hhc.outcomes.length > 0);
});

test('servicio sin familia en el contenido: error que nombra el servicio', async () => {
  const bad = { value: 'sin-familia', name: 'X', label: 'X', description: 'd', problem: 'p', solution: 's', outcomes: ['o'], category: { value: 'c', name: 'C', order: 1 }, position: 1 };
  assert.throws(() => groupServices([bad]), /sin-familia.*falta el objeto de familia o categoría/);
});

test('familia con nombre distinto entre servicios: error', () => {
  const a = { value: 'a', family: { value: 'f', name: 'F', order: 1 }, category: { value: 'c', name: 'C', order: 1 }, position: 1 };
  const b = { value: 'b', family: { value: 'f', name: 'G', order: 1 }, category: { value: 'c', name: 'C', order: 1 }, position: 2 };
  assert.throws(() => groupServices([a, b]), /familia f: nombre u orden distintos/);
});

test('el contenido real se lee desde content/services (no desde una copia)', async () => {
  const files = await readdir(path.join(DEFAULT_CONTENT_ROOT, 'services', 'es'));
  assert.equal(files.filter((f) => f.endsWith('.json')).length, 42);
});

let passed = 0;
try {
  console.log('Catálogo de servicios (contenido real)');
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
