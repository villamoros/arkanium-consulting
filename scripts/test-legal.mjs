/**
 * Pruebas de las páginas legales sobre el contenido real (content/legal/<idioma>/*.json).
 *   npm run test:legal
 * Comprueba que los cuatro documentos existen en los cuatro idiomas, con título, descripción y párrafos.
 */
import assert from 'node:assert/strict';
import { getLegalPages } from '../src/lib/legal/index.ts';

const LOCALES = ['en', 'es', 'pt', 'fr'];
const VALUES = ['cookies', 'disclaimer', 'privacy', 'terms'];

let passed = 0;
console.log('Páginas legales (contenido real)');
const docs = Object.fromEntries(await Promise.all(LOCALES.map(async (l) => [l, await getLegalPages(l)])));

const tests = [
  ['cuatro documentos por idioma', () => LOCALES.forEach((l) => assert.deepEqual(docs[l].map((d) => d.value).sort(), VALUES, l))],
  ['título y descripción en todos', () => LOCALES.forEach((l) => docs[l].forEach((d) => { assert.ok(d.title.trim(), `${l}/${d.value}`); assert.ok(d.description.trim(), `${l}/${d.value}`); }))],
  ['tres párrafos por documento (texto original)', () => LOCALES.forEach((l) => docs[l].forEach((d) => assert.equal(d.sections.length, 3, `${l}/${d.value}`)))],
  ['párrafos no vacíos', () => LOCALES.forEach((l) => docs[l].forEach((d) => d.sections.forEach((s) => assert.ok(s.trim(), `${l}/${d.value}`))))],
];

for (const [name, fn] of tests) {
  fn();
  passed++;
  console.log('  ✓', name);
}
console.log(`\n${passed} pruebas OK`);
